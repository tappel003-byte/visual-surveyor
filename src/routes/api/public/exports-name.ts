import { createFileRoute } from "@tanstack/react-router";
import { isSafeExportJobId } from "@/server/office-download";
import { sanitizeOfficeFolderName, updateExportJobFolderName } from "@/server/office-mutate";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Lovable-only: write folderName into manifest.json so office can rename job labels. */
export const Route = createFileRoute("/api/public/exports-name")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["EXPORTS_LIST_TOKEN"];
        const header = request.headers.get("authorization") || "";
        const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
        if (!expected || !token || !safeEqual(token, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { jobId?: string; folderName?: string } = {};
        try {
          body = (await request.json()) as { jobId?: string; folderName?: string };
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const jobId = body.jobId?.trim() || "";
        const folderName = sanitizeOfficeFolderName(body.folderName ?? "");
        if (!isSafeExportJobId(jobId)) {
          return Response.json({ error: "Invalid jobId" }, { status: 400 });
        }
        if (!folderName) {
          return Response.json({ error: "Invalid folderName" }, { status: 400 });
        }

        try {
          const result = await updateExportJobFolderName(jobId, folderName);
          return Response.json(result, { headers: { "Cache-Control": "no-store" } });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Update failed";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
