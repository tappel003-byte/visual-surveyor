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
      throw new Error("Sign in at /office with the company password, then try again.");
    }
    if (!isSafeExportJobId(data.jobId)) {
      throw new Error("That job link looks wrong. Go back to the office list and open the job again.");
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
      throw new Error("Sign in at /office with the company password, then try Download again.");
    }
    if (!isSafeExportJobId(data.jobId) || !isSafeExportRelativePath(data.path)) {
      throw new Error("That file link looks wrong. Open the job again from the office list.");
    }
    if (!exportsListTokenConfigured()) {
      throw new Error(
        "Download is not available right now. Tell whoever runs Netlify to check the shared office list token and Publish once in Lovable. Do not add storage service keys on Netlify.",
      );
    }

    const result = await fetchOfficeSignedUrlFromLovable(data.jobId.trim(), data.path.trim());
    if (!result.ok) {
      throw new Error("Sign in at /office with the company password, then try Download again.");
    }
    return { signedUrl: result.signedUrl, expiresIn: result.expiresIn };
  });
