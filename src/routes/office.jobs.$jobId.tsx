import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { JobFileExplorer } from "@/components/office/JobFileExplorer";
import { OfficeChrome } from "@/components/office/OfficeChrome";
import { officeAuthStatus, officeLogout } from "@/lib/office-auth.functions";
import { officeGetJobDownload } from "@/lib/office-download.functions";
import { officeListJobs, type OfficeJobFolder } from "@/lib/office-jobs.functions";
import { isSafeExportJobId } from "@/lib/office-file-tree";

export const Route = createFileRoute("/office/jobs/$jobId")({
  head: ({ params }) => ({
    meta: [
      { title: `PGG Office — Job ${params.jobId.slice(0, 8)}…` },
      { name: "description", content: "Browse and download files for a synced PGG field job." },
    ],
  }),
  beforeLoad: async () => {
    const auth = await officeAuthStatus();
    if (!auth.configured) {
      throw redirect({ to: "/office" });
    }
    if (!auth.authenticated) {
      throw redirect({ to: "/office" });
    }
  },
  loader: async ({ params }) => {
    const jobId = params.jobId.trim();
    if (!isSafeExportJobId(jobId)) {
      throw new Error("Invalid job id.");
    }
    const download = await officeGetJobDownload({ data: { jobId } });
    let jobs: OfficeJobFolder[] = [];
    let listAvailable = false;
    let displayName: string | null = null;
    try {
      const list = await officeListJobs();
      jobs = list.jobs;
      listAvailable = list.listAvailable;
      displayName = list.jobs.find((j) => j.id === jobId)?.displayName ?? null;
    } catch {
      /* list optional for Open */
    }
    const title = displayName || download.folderName || "Field export";
    return { jobId, title, download, jobs, listAvailable };
  },
  component: OfficeJobBrowserPage,
});

function OfficeJobBrowserPage() {
  const { jobId, title, download, jobs: initialJobs, listAvailable } = Route.useLoaderData();
  const [jobs, setJobs] = useState(initialJobs);
  const [refreshing, setRefreshing] = useState(false);
  const [listAvailableState, setListAvailableState] = useState(listAvailable);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const list = await officeListJobs();
      setJobs(list.jobs);
      setListAvailableState(list.listAvailable);
    } catch {
      /* keep current */
    } finally {
      setRefreshing(false);
    }
  };

  const onLogout = async () => {
    await officeLogout();
    window.location.href = "/office";
  };

  return (
    <OfficeChrome
      jobs={jobs}
      listAvailable={listAvailableState}
      selectedJobId={jobId}
      onRefresh={() => onRefresh().catch(() => {})}
      refreshing={refreshing}
      onJobsChanged={setJobs}
      onLogout={() => onLogout().catch(() => {})}
    >
      <JobFileExplorer jobId={jobId} title={title} data={download} embedded />
    </OfficeChrome>
  );
}
