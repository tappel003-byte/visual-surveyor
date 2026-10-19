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
import type { OfficePinsPayload } from "@/lib/office-pins";

const sourceSchema = z.enum(["blobs", "lovable"]).optional().nullable();

export const officeDeleteJob = createServerFn({ method: "POST" })
  .validator(
    z.object({
      jobId: z.string().min(1).max(200),
      source: sourceSchema,
    }),
  )
  .handler(async ({ data }): Promise<{ deleted: number }> => {
    if (!hasValidOfficeSession()) {
      throw new Error("Sign in required.");
    }
    if (!isSafeExportJobId(data.jobId)) {
      throw new Error("Invalid job id.");
    }

    const result = await fetchDeleteExportJobFromLovable(data.jobId.trim(), data.source ?? null);
    if (!result.ok) {
      throw new Error("Could not delete job.");
    }
    return { deleted: result.deleted };
  });

export const officeSetJobFrom = createServerFn({ method: "POST" })
  .validator(
    z.object({
      jobId: z.string().min(1).max(200),
      syncedFrom: z.string().min(1).max(80),
      source: sourceSchema,
    }),
  )
  .handler(async ({ data }): Promise<{ syncedFrom: string }> => {
    if (!hasValidOfficeSession()) {
      throw new Error("Sign in required.");
    }
    if (!isSafeExportJobId(data.jobId)) {
      throw new Error("Invalid job id.");
    }

    const result = await fetchSetExportFromFromLovable(
      data.jobId.trim(),
      data.syncedFrom.trim(),
      data.source ?? null,
    );
    if (!result.ok) {
      throw new Error("Could not update From.");
    }
    return { syncedFrom: result.syncedFrom };
  });

export const officeSetJobName = createServerFn({ method: "POST" })
  .validator(
    z.object({
      jobId: z.string().min(1).max(200),
      folderName: z.string().min(1).max(120),
      source: sourceSchema,
    }),
  )
  .handler(async ({ data }): Promise<{ folderName: string }> => {
    if (!hasValidOfficeSession()) {
      throw new Error("Sign in required.");
    }
    if (!isSafeExportJobId(data.jobId)) {
      throw new Error("Invalid job id.");
    }

    const result = await fetchSetExportNameFromLovable(
      data.jobId.trim(),
      data.folderName.trim(),
      data.source ?? null,
    );
    if (!result.ok) {
      throw new Error("Could not update job name.");
    }
    return { folderName: result.folderName };
  });

export const officeGetJobPins = createServerFn({ method: "POST" })
  .validator(
    z.object({
      jobId: z.string().min(1).max(200),
      source: sourceSchema,
    }),
  )
  .handler(async ({ data }): Promise<OfficePinsPayload> => {
    if (!hasValidOfficeSession()) {
      throw new Error("Sign in required.");
    }
    if (!isSafeExportJobId(data.jobId)) {
      throw new Error("Invalid job id.");
    }

    const result = await fetchExportPinsFromLovable(data.jobId.trim(), data.source ?? null);
    if (!result.ok) {
      throw new Error("Could not load pin notes.");
    }
    return result.payload;
  });

export const officeUpdateJobPins = createServerFn({ method: "POST" })
  .validator(
    z.object({
      jobId: z.string().min(1).max(200),
      source: sourceSchema,
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

    const result = await fetchUpdateExportPinsFromLovable(
      data.jobId.trim(),
      data.updates,
      data.source ?? null,
    );
    if (!result.ok) {
      throw new Error("Could not save pin notes.");
    }
    return result.payload;
  });
