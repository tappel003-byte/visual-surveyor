import { createFileRoute } from "@tanstack/react-router";
import { lightStatsForExportJob } from "@/server/export-storage-stats";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Office job list — Lovable-only, Bearer EXPORTS_LIST_TOKEN.
 *
 * Fast path: one top-level list + parallel `manifest.json` downloads per job.
 * Does NOT recursively walk each job’s files/ tree (that was the multi-second bottleneck).
 * Open / exports-job still walks for accurate sizes + sync-incomplete.
 */
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

        // Folders only (Supabase: id === null). Skip stray root files.
        const folders = (top || []).filter((item) => item.id === null && item.name?.trim());

        const folderStats = await Promise.all(
          folders.map(async (item) => {
            const stats = await lightStatsForExportJob(bucket, item.name);
            return {
              id: stats.id,
              displayName: stats.displayName,
              fileCount: stats.fileCount,
              totalBytes: stats.totalBytes,
              manifestFileCount: stats.manifestFileCount,
              storageObjectCount: stats.storageObjectCount,
              syncIncomplete: stats.syncIncomplete,
              syncedAt: stats.syncedAt,
              syncedFrom: stats.syncedFrom,
            };
          }),
        );

        // Newest synced first when timestamps exist
        folderStats.sort((a, b) => {
          const ta = a.syncedAt ? Date.parse(a.syncedAt) : 0;
          const tb = b.syncedAt ? Date.parse(b.syncedAt) : 0;
          if (tb !== ta) return tb - ta;
          return (a.displayName || a.id).localeCompare(b.displayName || b.id);
        });

        return Response.json(
          { jobs: folderStats, listMode: "manifest-light" },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
