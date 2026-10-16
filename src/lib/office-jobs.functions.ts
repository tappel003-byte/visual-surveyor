import { createServerFn } from "@tanstack/react-start";
import { hasValidOfficeSession } from "@/server/office-session";
import {
  listExportJobFolders,
  supabaseAdminConfigured,
  type OfficeJobFolder,
} from "@/server/office-jobs";

export type OfficeJobListResult = {
  storageConfigured: boolean;
  jobs: OfficeJobFolder[];
};

export const officeListJobs = createServerFn({ method: "GET" }).handler(async (): Promise<OfficeJobListResult> => {
  if (!hasValidOfficeSession()) {
    throw new Error("Sign in required.");
  }

  if (!supabaseAdminConfigured()) {
    return { storageConfigured: false, jobs: [] };
  }

  const jobs = await listExportJobFolders();
  return { storageConfigured: true, jobs };
});
