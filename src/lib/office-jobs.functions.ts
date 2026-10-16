import { createServerFn } from "@tanstack/react-start";
import { hasValidOfficeSession } from "@/server/office-session";
import {
  exportsListTokenConfigured,
  fetchExportJobListFromLovable,
  type OfficeJobFolder,
} from "@/server/office-jobs";

export type OfficeJobListResult = {
  listAvailable: boolean;
  jobs: OfficeJobFolder[];
};

export const officeListJobs = createServerFn({ method: "GET" }).handler(async (): Promise<OfficeJobListResult> => {
  if (!hasValidOfficeSession()) {
    throw new Error("Sign in required.");
  }

  if (!exportsListTokenConfigured()) {
    return { listAvailable: false, jobs: [] };
  }

  const result = await fetchExportJobListFromLovable();
  if (!result.ok) {
    return { listAvailable: false, jobs: [] };
  }

  return { listAvailable: true, jobs: result.jobs };
});
