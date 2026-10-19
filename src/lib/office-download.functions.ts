import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hasValidOfficeSession } from "@/server/office-session";
import {
  isSafeExportJobId,
  isSafeExportRelativePath,
  resolveOfficeJobDownload,
  signOfficeExportFile,
  type OfficeJobDownloadPayload,
} from "@/server/office-download";

export type OfficeJobDownloadResult = OfficeJobDownloadPayload & {
  storageLinksAvailable: boolean;
};

const sourceSchema = z.enum(["blobs", "lovable"]).optional().nullable();

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
    source: "blobs",
  };
}

export const officeGetJobDownload = createServerFn({ method: "POST" })
  .validator(
    z.object({
      jobId: z.string().min(1).max(200),
      source: sourceSchema,
    }),
  )
  .handler(async ({ data }): Promise<OfficeJobDownloadResult> => {
    if (!hasValidOfficeSession()) {
      throw new Error("Sign in at /office with the company password, then try again.");
    }
    if (!isSafeExportJobId(data.jobId)) {
      throw new Error(
        "That job link looks wrong. Go back to the office list and open the job again.",
      );
    }

    const jobId = data.jobId.trim();
    try {
      const payload = await resolveOfficeJobDownload(jobId, data.source ?? null);
      return {
        ...payload,
        storageLinksAvailable: payload.files.length > 0 || payload.storageObjectCount > 0,
      };
    } catch (e) {
      console.error("[officeGetJobDownload]", e);
      return { ...emptyDownload(jobId), storageLinksAvailable: false };
    }
  });

/** Lazy access: Blobs chunk marker or Lovable signed HTTPS URL. */
export const officeSignFile = createServerFn({ method: "POST" })
  .validator(
    z.object({
      jobId: z.string().min(1).max(200),
      path: z.string().min(1).max(500),
      source: sourceSchema,
    }),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      signedUrl: string;
      expiresIn: number;
      totalChunks: number;
      sizeBytes: number;
      access: "chunk" | "signed";
      source: "blobs" | "lovable";
    }> => {
      if (!hasValidOfficeSession()) {
        throw new Error("Sign in at /office with the company password, then try Download again.");
      }
      if (!isSafeExportJobId(data.jobId) || !isSafeExportRelativePath(data.path)) {
        throw new Error("That file link looks wrong. Open the job again from the office list.");
      }

      const result = await signOfficeExportFile(
        data.jobId.trim(),
        data.path.trim(),
        data.source ?? null,
      );
      if (!result) {
        throw new Error("Could not prepare that file. Refresh and try again.");
      }
      return result;
    },
  );
