import { createFileRoute } from "@tanstack/react-router";
import { hasValidOfficeSession } from "@/server/office-session";
import { addDownloadMonthBytes, readStoredChunk } from "@/server/office-blobs";

/**
 * Desk Download: one raw chunk of one file (session cookie required).
 * Query: jobId, path, index
 * Does not hold a whole job in memory — one chunk response only.
 */
export const Route = createFileRoute("/api/office/file-chunk")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!hasValidOfficeSession()) {
          return new Response("Sign in required.", {
            status: 401,
            headers: { "Cache-Control": "no-store" },
          });
        }

        const url = new URL(request.url);
        const jobId = url.searchParams.get("jobId")?.trim() || "";
        const path = url.searchParams.get("path")?.trim() || "";
        const index = Number(url.searchParams.get("index"));
        const meter = url.searchParams.get("meter") === "1";
        if (!Number.isFinite(index) || index < 0) {
          return new Response("Bad chunk index.", { status: 400 });
        }

        const chunk = await readStoredChunk(jobId, path, index);
        if (!chunk) {
          return new Response("File not found.", {
            status: 404,
            headers: { "Cache-Control": "no-store" },
          });
        }

        // Count toward estimate only for explicit Download (meter=1), last chunk.
        if (meter && index === chunk.totalChunks - 1) {
          try {
            await addDownloadMonthBytes(chunk.totalSize);
          } catch (e) {
            console.warn("[office-file-chunk] download counter failed", e);
          }
        }

        return new Response(chunk.bytes, {
          status: 200,
          headers: {
            "Content-Type": chunk.contentType || "application/octet-stream",
            "Cache-Control": "no-store",
            "X-PGG-File-Size": String(chunk.totalSize),
            "X-PGG-Total-Chunks": String(chunk.totalChunks),
            "X-PGG-Chunk-Index": String(index),
          },
        });
      },
    },
  },
});
