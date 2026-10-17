import { createFileRoute } from "@tanstack/react-router";
import {
  buildOfficeJobDownload,
  isSafeExportJobId,
} from "@/server/office-download";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Lovable-only: list job files without signing (lazy sign via /api/public/exports-sign). */
export const Route = createFileRoute("/api/public/exports-job")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env["EXPORTS_LIST_TOKEN"];
        const header = request.headers.get("authorization") || "";
        const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
        if (!expected || !token || !safeEqual(token, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const jobId = new URL(request.url).searchParams.get("jobId")?.trim() || "";
        if (!isSafeExportJobId(jobId)) {
          return Response.json({ error: "Invalid jobId" }, { status: 400 });
        }

        const payload = await buildOfficeJobDownload(jobId);
        return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
