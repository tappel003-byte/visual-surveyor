import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hasValidOfficeSession } from "@/server/office-session";
import { isSafeExportJobId } from "@/server/office-download";
import {
  fetchDeleteExportJobFromLovable,
  fetchSetExportFromFromLovable,
} from "@/server/office-mutate";
import { exportsListTokenConfigured } from "@/server/office-jobs";

export const officeDeleteJob = createServerFn({ method: "POST" })
  .validator(z.object({ jobId: z.string().min(1).max(200) }))
  .handler(async ({ data }): Promise<{ deleted: number }> => {
    if (!hasValidOfficeSession()) {
      throw new Error("Sign in required.");
    }
    if (!isSafeExportJobId(data.jobId)) {
      throw new Error("Invalid job id.");
    }
    if (!exportsListTokenConfigured()) {
      throw new Error("EXPORTS_LIST_TOKEN is not configured.");
    }

    const result = await fetchDeleteExportJobFromLovable(data.jobId.trim());
    if (!result.ok) {
      throw new Error("Could not delete job (unauthorized).");
    }
    return { deleted: result.deleted };
  });

export const officeSetJobFrom = createServerFn({ method: "POST" })
  .validator(
    z.object({
      jobId: z.string().min(1).max(200),
      syncedFrom: z.string().min(1).max(80),
    }),
  )
  .handler(async ({ data }): Promise<{ syncedFrom: string }> => {
    if (!hasValidOfficeSession()) {
      throw new Error("Sign in required.");
    }
    if (!isSafeExportJobId(data.jobId)) {
      throw new Error("Invalid job id.");
    }
    if (!exportsListTokenConfigured()) {
      throw new Error("EXPORTS_LIST_TOKEN is not configured.");
    }

    const result = await fetchSetExportFromFromLovable(data.jobId.trim(), data.syncedFrom.trim());
    if (!result.ok) {
      throw new Error("Could not update From (unauthorized).");
    }
    return { syncedFrom: result.syncedFrom };
  });
