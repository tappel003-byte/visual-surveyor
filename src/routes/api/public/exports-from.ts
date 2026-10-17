import { createFileRoute } from "@tanstack/react-router";
import { isSafeExportJobId } from "@/server/office-download";
import { updateExportJobFrom } from "@/server/office-mutate";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Lovable-only: write syncedFrom into manifest.json so office can label old jobs. */
export const Route = createFileRoute("/api/public/exports-from")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["EXPORTS_LIST_TOKEN"];
        const header = request.headers.get("authorization") || "";
        const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
        if (!expected || !token || !safeEqual(token, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { jobId?: string; syncedFrom?: string } = {};
        try {
          body = (await request.json()) as { jobId?: string; syncedFrom?: string };
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const jobId = body.jobId?.trim() || "";
        const syncedFrom = body.syncedFrom?.trim() || "";
        if (!isSafeExportJobId(jobId)) {
          return Response.json({ error: "Invalid jobId" }, { status: 400 });
        }
        if (!syncedFrom || syncedFrom.length > 80) {
          return Response.json({ error: "Invalid syncedFrom" }, { status: 400 });
        }

        try {
          const result = await updateExportJobFrom(jobId, syncedFrom);
          return Response.json(result, { headers: { "Cache-Control": "no-store" } });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Update failed";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
