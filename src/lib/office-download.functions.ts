import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hasValidOfficeSession } from "@/server/office-session";
import {
  fetchOfficeJobDownloadFromLovable,
  fetchOfficeSignedUrlFromLovable,
  isSafeExportJobId,
  isSafeExportRelativePath,
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

/** Lazy sign-on-click: mint one file URL via Lovable (Netlify has no service role). */
export const officeSignFile = createServerFn({ method: "POST" })
  .validator(
    z.object({
      jobId: z.string().min(1).max(200),
      path: z.string().min(1).max(500),
    }),
  )
  .handler(async ({ data }): Promise<{ signedUrl: string; expiresIn: number }> => {
    if (!hasValidOfficeSession()) {
      throw new Error("Sign in required.");
    }
    if (!isSafeExportJobId(data.jobId) || !isSafeExportRelativePath(data.path)) {
      throw new Error("Invalid file request.");
    }
    if (!exportsListTokenConfigured()) {
      throw new Error("EXPORTS_LIST_TOKEN is not configured.");
    }

    const result = await fetchOfficeSignedUrlFromLovable(data.jobId.trim(), data.path.trim());
    if (!result.ok) {
      throw new Error("Could not sign file (unauthorized).");
    }
    return { signedUrl: result.signedUrl, expiresIn: result.expiresIn };
  });
