import { createServerFn } from "@tanstack/react-start";
import {
  fetchExportJobListFromBlobs,
  officeLockerConfigured,
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

    if (!officeLockerConfigured()) {
      return { listAvailable: false, jobs: [], locker: null };
    }

    try {
      const result = await fetchExportJobListFromBlobs();
      return { listAvailable: true, jobs: result.jobs, locker: result.locker };
    } catch (e) {
      console.error("[officeListJobs] blobs list failed", e);
      return { listAvailable: false, jobs: [], locker: null };
    }
  },
);
