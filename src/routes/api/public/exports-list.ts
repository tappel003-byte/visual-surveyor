import { createFileRoute } from "@tanstack/react-router";
import { statsForExportJob } from "@/server/export-storage-stats";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/exports-list")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env["EXPORTS_LIST_TOKEN"];
        const header = request.headers.get("authorization") || "";
        const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
        if (!expected || !token || !safeEqual(token, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const bucket = supabaseAdmin.storage.from("exports");
        const { data: top, error } = await bucket.list("", { limit: 1000 });
        if (error) return Response.json({ error: "List failed" }, { status: 500 });

        const folderStats = await Promise.all(
          (top || []).map(async (item) => {
              const stats = await statsForExportJob(bucket, item.name);
              return {
                id: stats.id,
                displayName: stats.displayName,
                fileCount: stats.fileCount,
                totalBytes: stats.totalBytes,
                manifestFileCount: stats.manifestFileCount,
                storageObjectCount: stats.storageObjectCount,
                syncIncomplete: stats.syncIncomplete,
              };
            }),
        );

        return Response.json({ jobs: folderStats }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
