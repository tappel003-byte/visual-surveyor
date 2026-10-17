import { createFileRoute, redirect } from "@tanstack/react-router";
import { JobFileExplorer } from "@/components/office/JobFileExplorer";
import { officeAuthStatus } from "@/lib/office-auth.functions";
import { officeGetJobDownload } from "@/lib/office-download.functions";
import { officeListJobs } from "@/lib/office-jobs.functions";
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
    let displayName: string | null = null;
    try {
      const jobs = await officeListJobs();
      displayName = jobs.jobs.find((j) => j.id === jobId)?.displayName ?? null;
    } catch {
      /* list optional */
    }
    const title = displayName || download.folderName || "Field export";
    return { jobId, title, download };
  },
  component: OfficeJobBrowserPage,
});

function OfficeJobBrowserPage() {
  const { jobId, title, download } = Route.useLoaderData();
  return <JobFileExplorer jobId={jobId} title={title} data={download} />;
}
