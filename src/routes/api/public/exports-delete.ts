import { createFileRoute } from "@tanstack/react-router";
import { isSafeExportJobId } from "@/server/office-download";
import { deleteExportJobFolderSupabase } from "@/server/office-mutate";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Lovable-only: delete exports/<jobId>/ with service role (Netlify calls with Bearer token). */
export const Route = createFileRoute("/api/public/exports-delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["EXPORTS_LIST_TOKEN"];
        const header = request.headers.get("authorization") || "";
        const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
        if (!expected || !token || !safeEqual(token, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let jobId = new URL(request.url).searchParams.get("jobId")?.trim() || "";
        if (!jobId) {
          try {
            const body = (await request.json()) as { jobId?: string };
            jobId = body.jobId?.trim() || "";
          } catch {
            jobId = "";
          }
        }
        if (!isSafeExportJobId(jobId)) {
          return Response.json({ error: "Invalid jobId" }, { status: 400 });
        }

        try {
          // Lovable-only endpoint: always the Supabase exports locker (not Blobs).
          const result = await deleteExportJobFolderSupabase(jobId);
          return Response.json(result, { headers: { "Cache-Control": "no-store" } });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Delete failed";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
