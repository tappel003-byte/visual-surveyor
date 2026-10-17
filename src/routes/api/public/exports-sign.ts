import { createFileRoute } from "@tanstack/react-router";
import {
  isSafeExportJobId,
  isSafeExportRelativePath,
  signOfficeExportFile,
} from "@/server/office-download";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Lovable-only: mint one signed export URL on click (lazy Open).
 * Netlify calls with Bearer EXPORTS_LIST_TOKEN — never exposes service role.
 */
export const Route = createFileRoute("/api/public/exports-sign")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env["EXPORTS_LIST_TOKEN"];
        const header = request.headers.get("authorization") || "";
        const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
        if (!expected || !token || !safeEqual(token, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const url = new URL(request.url);
        const jobId = url.searchParams.get("jobId")?.trim() || "";
        const path = url.searchParams.get("path")?.trim() || "";
        if (!isSafeExportJobId(jobId)) {
          return Response.json({ error: "Invalid jobId" }, { status: 400 });
        }
        if (!isSafeExportRelativePath(path)) {
          return Response.json({ error: "Invalid path" }, { status: 400 });
        }

        const signed = await signOfficeExportFile(jobId, path);
        if (!signed) {
          return Response.json({ error: "Could not sign file" }, { status: 404 });
        }

        return Response.json(signed, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
