import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hasValidOfficeSession } from "@/server/office-session";
import {
  buildOfficeJobDownload,
  isSafeExportJobId,
  isSafeExportRelativePath,
  signOfficeExportFile,
  type OfficeJobDownloadPayload,
} from "@/server/office-download";
import { officeLockerConfigured } from "@/server/office-jobs";

export type OfficeJobDownloadResult = OfficeJobDownloadPayload & {
  storageLinksAvailable: boolean;
};

function emptyDownload(jobId: string): OfficeJobDownloadPayload {
  return {
    jobId,
    kind: "empty",
    folderName: null,
    uploadKind: null,
    syncedAt: null,
    syncedFrom: null,
    getPagePath: `/get?job=${encodeURIComponent(jobId)}`,
    signedUrlTtlSeconds: 60 * 60,
    files: [],
    manifestExpectedFiles: null,
    storageObjectCount: 0,
    syncIncomplete: false,
    missingManifestPaths: 0,
  };
}

export const officeGetJobDownload = createServerFn({ method: "POST" })
  .validator(z.object({ jobId: z.string().min(1).max(200) }))
  .handler(async ({ data }): Promise<OfficeJobDownloadResult> => {
    if (!hasValidOfficeSession()) {
      throw new Error("Sign in at /office with the company password, then try again.");
    }
    if (!isSafeExportJobId(data.jobId)) {
      throw new Error("That job link looks wrong. Go back to the office list and open the job again.");
    }

    const jobId = data.jobId.trim();
    if (!officeLockerConfigured()) {
      return { ...emptyDownload(jobId), storageLinksAvailable: false };
    }

    const payload = await buildOfficeJobDownload(jobId);
    return {
      ...payload,
      storageLinksAvailable: true,
    };
  });

/** Lazy access: same-origin chunk marker (session cookie authorizes Download). */
export const officeSignFile = createServerFn({ method: "POST" })
  .validator(
    z.object({
      jobId: z.string().min(1).max(200),
      path: z.string().min(1).max(500),
    }),
  )
  .handler(
    async ({
      data,
    }): Promise<{ signedUrl: string; expiresIn: number; totalChunks: number; sizeBytes: number }> => {
      if (!hasValidOfficeSession()) {
        throw new Error("Sign in at /office with the company password, then try Download again.");
      }
      if (!isSafeExportJobId(data.jobId) || !isSafeExportRelativePath(data.path)) {
        throw new Error("That file link looks wrong. Open the job again from the office list.");
      }
      if (!officeLockerConfigured()) {
        throw new Error(
          "Download is not available right now. Tell whoever runs Netlify to check the site deploy.",
        );
      }

      const result = await signOfficeExportFile(data.jobId.trim(), data.path.trim());
      if (!result) {
        throw new Error("Could not prepare that file. Refresh and try again.");
      }
      return result;
    },
  );
