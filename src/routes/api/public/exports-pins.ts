import { createFileRoute } from "@tanstack/react-router";
import { isSafeExportJobId } from "@/server/office-download";
import type { PinDescriptionUpdate } from "@/lib/office-pins";
import { readExportJobPins, updateExportJobPinDescriptions } from "@/server/office-pins";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorize(request: Request): boolean {
  const expected = process.env["EXPORTS_LIST_TOKEN"];
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return Boolean(expected && token && safeEqual(token, expected));
}

/**
 * Lovable-only: read / update pin descriptions in pins.csv (Netlify Bearer EXPORTS_LIST_TOKEN).
 * Phase A — notes only; pin move is Phase B.
 */
export const Route = createFileRoute("/api/public/exports-pins")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorize(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const jobId = new URL(request.url).searchParams.get("jobId")?.trim() || "";
        if (!isSafeExportJobId(jobId)) {
          return Response.json({ error: "Invalid jobId" }, { status: 400 });
        }

        try {
          const payload = await readExportJobPins(jobId);
          return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Read failed";
          return Response.json({ error: msg }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        if (!authorize(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { jobId?: string; updates?: PinDescriptionUpdate[] } = {};
        try {
          body = (await request.json()) as { jobId?: string; updates?: PinDescriptionUpdate[] };
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const jobId = body.jobId?.trim() || "";
        if (!isSafeExportJobId(jobId)) {
          return Response.json({ error: "Invalid jobId" }, { status: 400 });
        }
        if (!Array.isArray(body.updates) || body.updates.length === 0) {
          return Response.json({ error: "updates required" }, { status: 400 });
        }

        const updates: PinDescriptionUpdate[] = body.updates.map((u) => ({
          pinId: typeof u.pinId === "string" ? u.pinId : undefined,
          pinNum: typeof u.pinNum === "string" ? u.pinNum : undefined,
          description: String(u.description ?? "").slice(0, 8000),
        }));

        try {
          const payload = await updateExportJobPinDescriptions(jobId, updates);
          return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Update failed";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
