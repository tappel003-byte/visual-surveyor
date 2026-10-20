import { createFileRoute } from "@tanstack/react-router";
import {
  acceptUploadChunk,
  CHUNK_MAX_BYTES,
  plainCapMessage,
  verifyFieldKey,
} from "@/server/office-blobs";

/**
 * Field Sync: PUT raw binary piece (≤4 MB).
 * Query: jobId, path, index, total, size
 * Header: X-PGG-Field-Key
 */
export const Route = createFileRoute("/api/field/sync-chunk")({
  server: {
    handlers: {
      PUT: async ({ request }) => {
        try {
          if (!verifyFieldKey(request.headers.get("x-pgg-field-key"))) {
            return Response.json(
              { error: plainCapMessage("field-key") },
              { status: 401, headers: { "Cache-Control": "no-store" } },
            );
          }

          const url = new URL(request.url);
          const jobId = url.searchParams.get("jobId")?.trim() || "";
          const path = url.searchParams.get("path")?.trim() || "";
          const index = Number(url.searchParams.get("index"));
          const total = Number(url.searchParams.get("total"));
          const size = Number(url.searchParams.get("size"));
          const contentType =
            request.headers.get("content-type")?.split(";")[0]?.trim() ||
            "application/octet-stream";

          if (!Number.isFinite(index) || !Number.isFinite(total) || !Number.isFinite(size)) {
            return Response.json({ error: "Upload piece numbers look wrong." }, { status: 400 });
          }

          const buf = await request.arrayBuffer();
          if (buf.byteLength > CHUNK_MAX_BYTES) {
            return Response.json(
              { error: plainCapMessage("chunk") },
              { status: 413, headers: { "Cache-Control": "no-store" } },
            );
          }

          const result = await acceptUploadChunk({
            jobId,
            path,
            index,
            totalChunks: total,
            sizeBytes: size,
            contentType,
            body: buf,
          });

          if (!result.ok) {
            return Response.json(
              { error: result.message },
              { status: result.status, headers: { "Cache-Control": "no-store" } },
            );
          }

          return Response.json(
            { complete: result.complete, received: result.received },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          console.error("[sync-chunk]", error);
          return Response.json(
            {
              error:
                "Couldn’t upload to office staging. Photos are still on this phone.\n\n" +
                "Try Sync again when you have a signal. If it keeps failing, tell the office.",
            },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
