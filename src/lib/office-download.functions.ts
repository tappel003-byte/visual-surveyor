import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hasValidOfficeSession } from "@/server/office-session";
import {
  fetchOfficeJobDownloadFromLovable,
  isSafeExportJobId,
  type OfficeJobDownloadPayload,
} from "@/server/office-download";
import { exportsListTokenConfigured } from "@/server/office-jobs";

export type OfficeJobDownloadResult = OfficeJobDownloadPayload & {
  storageLinksAvailable: boolean;
};

function emptyDownload(jobId: string): OfficeJobDownloadPayload {
  return {
    jobId,
    kind: "empty",
    folderName: null,
    uploadKind: null,
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
      throw new Error("Sign in required.");
    }
    if (!isSafeExportJobId(data.jobId)) {
      throw new Error("Invalid job id.");
    }

    const jobId = data.jobId.trim();
    if (!exportsListTokenConfigured()) {
      return { ...emptyDownload(jobId), storageLinksAvailable: false };
    }

    const result = await fetchOfficeJobDownloadFromLovable(jobId);
    if (!result.ok) {
      return { ...emptyDownload(jobId), storageLinksAvailable: false };
    }

    return {
      ...result.payload,
      storageLinksAvailable: true,
    };
  });
