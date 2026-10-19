import { createServerFn } from "@tanstack/react-start";
import {
  fetchMergedOfficeJobList,
  type OfficeJobFolder,
  type OfficeLockerStats,
} from "@/server/office-jobs";
import { hasValidOfficeSession } from "@/server/office-session";

export type OfficeJobListResult = {
  listAvailable: boolean;
  jobs: OfficeJobFolder[];
  locker: OfficeLockerStats | null;
};

export type { OfficeJobFolder, OfficeLockerStats };

/** POST avoids browser/CDN caching so Refresh always re-fetches the job list. */
export const officeListJobs = createServerFn({ method: "POST" }).handler(
  async (): Promise<OfficeJobListResult> => {
    if (!hasValidOfficeSession()) {
      throw new Error("Sign in required.");
    }

    return fetchMergedOfficeJobList();
  },
);
