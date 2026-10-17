import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hasValidOfficeSession } from "@/server/office-session";
import { isSafeExportJobId } from "@/server/office-download";
import {
  fetchDeleteExportJobFromLovable,
  fetchExportPinsFromLovable,
  fetchSetExportFromFromLovable,
  fetchSetExportNameFromLovable,
  fetchUpdateExportPinsFromLovable,
} from "@/server/office-mutate";
import { exportsListTokenConfigured } from "@/server/office-jobs";
import type { OfficePinsPayload } from "@/lib/office-pins";

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

export const officeSetJobName = createServerFn({ method: "POST" })
  .validator(
    z.object({
      jobId: z.string().min(1).max(200),
      folderName: z.string().min(1).max(120),
    }),
  )
  .handler(async ({ data }): Promise<{ folderName: string }> => {
    if (!hasValidOfficeSession()) {
      throw new Error("Sign in required.");
    }
    if (!isSafeExportJobId(data.jobId)) {
      throw new Error("Invalid job id.");
    }
    if (!exportsListTokenConfigured()) {
      throw new Error("EXPORTS_LIST_TOKEN is not configured.");
    }

    const result = await fetchSetExportNameFromLovable(data.jobId.trim(), data.folderName.trim());
    if (!result.ok) {
      throw new Error("Could not update job name (unauthorized).");
    }
    return { folderName: result.folderName };
  });

export const officeGetJobPins = createServerFn({ method: "POST" })
  .validator(z.object({ jobId: z.string().min(1).max(200) }))
  .handler(async ({ data }): Promise<OfficePinsPayload> => {
    if (!hasValidOfficeSession()) {
      throw new Error("Sign in required.");
    }
    if (!isSafeExportJobId(data.jobId)) {
      throw new Error("Invalid job id.");
    }
    if (!exportsListTokenConfigured()) {
      throw new Error("EXPORTS_LIST_TOKEN is not configured.");
    }

    const result = await fetchExportPinsFromLovable(data.jobId.trim());
    if (!result.ok) {
      throw new Error("Could not load pin notes (unauthorized).");
    }
    return result.payload;
  });

export const officeUpdateJobPins = createServerFn({ method: "POST" })
  .validator(
    z.object({
      jobId: z.string().min(1).max(200),
      updates: z
        .array(
          z.object({
            pinId: z.string().max(200).optional(),
            pinNum: z.string().max(40).optional(),
            description: z.string().max(8000),
          }),
        )
        .min(1)
        .max(500),
    }),
  )
  .handler(async ({ data }): Promise<OfficePinsPayload> => {
    if (!hasValidOfficeSession()) {
      throw new Error("Sign in required.");
    }
    if (!isSafeExportJobId(data.jobId)) {
      throw new Error("Invalid job id.");
    }
    if (!exportsListTokenConfigured()) {
      throw new Error("EXPORTS_LIST_TOKEN is not configured.");
    }

    const result = await fetchUpdateExportPinsFromLovable(data.jobId.trim(), data.updates);
    if (!result.ok) {
      throw new Error("Could not save pin notes (unauthorized).");
    }
    return result.payload;
  });
