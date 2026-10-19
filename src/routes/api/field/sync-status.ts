import { createFileRoute } from "@tanstack/react-router";
import {
  cleanupStaleIncompleteUploads,
  getUploadFileStatus,
  LOCKER_BUDGET_BYTES,
  plainCapMessage,
  sumLockerBytes,
  verifyFieldKey,
} from "@/server/office-blobs";

/**
 * Field Sync: check resume state for one file, or locker capacity (no path).
 * Header: X-PGG-Field-Key
 */
export const Route = createFileRoute("/api/field/sync-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!verifyFieldKey(request.headers.get("x-pgg-field-key"))) {
          return Response.json(
            { error: plainCapMessage("field-key") },
            { status: 401, headers: { "Cache-Control": "no-store" } },
          );
        }

        await cleanupStaleIncompleteUploads();

        const url = new URL(request.url);
        const jobId = url.searchParams.get("jobId")?.trim() || "";
        const path = url.searchParams.get("path")?.trim() || "";
        const used = await sumLockerBytes();

        if (!path) {
          return Response.json(
            {
              lockerUsedBytes: used,
              lockerBudgetBytes: LOCKER_BUDGET_BYTES,
              lockerFull: used >= LOCKER_BUDGET_BYTES,
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        }

        const status = await getUploadFileStatus(jobId, path);
        return Response.json(
          {
            ...status,
            lockerUsedBytes: used,
            lockerBudgetBytes: LOCKER_BUDGET_BYTES,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
