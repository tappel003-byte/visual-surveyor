import { createServerFn } from "@tanstack/react-start";
import {
  exportsListTokenConfigured,
  fetchExportJobListFromLovable,
  type OfficeJobFolder,
} from "@/server/office-jobs";
import { hasValidOfficeSession } from "@/server/office-session";

export type OfficeJobListResult = {
  listAvailable: boolean;
  jobs: OfficeJobFolder[];
};

export type { OfficeJobFolder };

/** POST avoids browser/CDN caching so Refresh always re-fetches the job list. */
export const officeListJobs = createServerFn({ method: "POST" }).handler(async (): Promise<OfficeJobListResult> => {
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
