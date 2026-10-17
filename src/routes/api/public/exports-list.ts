import { createFileRoute } from "@tanstack/react-router";

type ExportManifest = { folderName?: string };

async function displayNameFromManifest(
  bucket: ReturnType<typeof import("@/integrations/supabase/client.server").supabaseAdmin.storage.from>,
  jobId: string,
): Promise<string | null> {
  const { data, error } = await bucket.download(`${jobId}/manifest.json`);
  if (error || !data) return null;
  try {
    const parsed = JSON.parse(await data.text()) as ExportManifest;
    const name = parsed.folderName?.trim();
    return name || null;
  } catch {
    return null;
  }
}

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
            let fileCount = 0;
            let totalBytes = 0;
            const { data: sub } = await bucket.list(item.name, { limit: 1000 });
            for (const f of sub || []) {
              if (f.id === null) {
                const { data: nested } = await bucket.list(`${item.name}/${f.name}`, { limit: 1000 });
                for (const n of nested || []) {
                  fileCount++;
                  totalBytes += Number(n.metadata?.size || 0);
                }
              } else {
                fileCount++;
                totalBytes += Number(f.metadata?.size || 0);
              }
            }
            const displayName = await displayNameFromManifest(bucket, item.name);
            return { id: item.name, displayName, fileCount, totalBytes };
          }),
        );

        return Response.json({ jobs: folderStats }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
