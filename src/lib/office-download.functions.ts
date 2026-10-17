import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hasValidOfficeSession } from "@/server/office-session";
import {
  buildOfficeJobDownload,
  isSafeExportJobId,
  officeDownloadStorageConfigured,
  type OfficeJobDownloadPayload,
} from "@/server/office-download";

export type OfficeJobDownloadResult = OfficeJobDownloadPayload & {
  storageLinksAvailable: boolean;
};

export const officeGetJobDownload = createServerFn({ method: "POST" })
  .validator(z.object({ jobId: z.string().min(1).max(200) }))
  .handler(async ({ data }): Promise<OfficeJobDownloadResult> => {
    if (!hasValidOfficeSession()) {
      throw new Error("Sign in required.");
    }
    if (!isSafeExportJobId(data.jobId)) {
      throw new Error("Invalid job id.");
    }

    const payload = await buildOfficeJobDownload(data.jobId.trim());
    return {
      ...payload,
      storageLinksAvailable: officeDownloadStorageConfigured(),
    };
  });
