import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { JobFileExplorer } from "@/components/office/JobFileExplorer";
import { OfficeChrome, PGG } from "@/components/office/OfficeChrome";
import { officeAuthStatus, officeLogout } from "@/lib/office-auth.functions";
import { officeGetJobDownload } from "@/lib/office-download.functions";
import { officeListJobs, type OfficeJobFolder } from "@/lib/office-jobs.functions";
import {
  jobsCacheIsFresh,
  patchJobsCache,
  readJobsCache,
  writeJobsCache,
} from "@/lib/office-client-cache";
import { isSafeExportJobId } from "@/lib/office-file-tree";
import { OFFICE_AUTO_PACKAGE_KEY } from "@/lib/office-package-download";

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
  /** Fast path: only fetch this job’s files. Sidebar list comes from session cache + soft refresh. */
  loader: async ({ params }) => {
    const jobId = params.jobId.trim();
    if (!isSafeExportJobId(jobId)) {
      throw new Error("Invalid job id.");
    }
    const cached = readJobsCache();
    const source = cached?.jobs.find((j) => j.id === jobId)?.source ?? null;
    const download = await officeGetJobDownload({ data: { jobId, source } });
    const title = download.folderName || "Field export";
    return { jobId, title, download };
  },
  pendingComponent: () => (
    <div
      style={{
        minHeight: "40vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: PGG.muted,
        background: PGG.bg,
        padding: 24,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          border: `2px solid ${PGG.line}`,
          borderTopColor: PGG.accent,
          borderRadius: "50%",
          animation: "office-spin .7s linear infinite",
        }}
      />
      <span style={{ fontWeight: 600, color: PGG.ink }}>Opening job…</span>
      <style>{`@keyframes office-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ),
  component: OfficeJobBrowserPage,
});

function OfficeJobBrowserPage() {
  const {
    jobId,
    title: loaderTitle,
    download,
  } = Route.useLoaderData() as {
    jobId: string;
    title: string;
    download: Awaited<ReturnType<typeof officeGetJobDownload>>;
  };
  const navigate = useNavigate();
  const cached = typeof window !== "undefined" ? readJobsCache() : null;
  const [jobs, setJobs] = useState<OfficeJobFolder[]>(cached?.jobs ?? []);
  const [listAvailableState, setListAvailableState] = useState(cached?.listAvailable ?? true);
  const [refreshing, setRefreshing] = useState(false);
  const [listHydrating, setListHydrating] = useState(!cached);
  const [explorerStatus, setExplorerStatus] = useState<string | null>(null);
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [folderSegments, setFolderSegments] = useState<string[]>([]);
  const packageTriggerRef = useRef<(() => void) | null>(null);
  const navigateUpRef = useRef<(() => void) | null>(null);
  const [autoPackageDownload] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const flag = sessionStorage.getItem(OFFICE_AUTO_PACKAGE_KEY);
      if (flag === jobId) {
        sessionStorage.removeItem(OFFICE_AUTO_PACKAGE_KEY);
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  });

  const listTitle = jobs.find((j) => j.id === jobId)?.displayName || null;
  const title = titleOverride || listTitle || loaderTitle;

  const softRefreshList = async (force = false) => {
    if (!force && jobsCacheIsFresh()) {
      const hit = readJobsCache();
      if (hit) {
        setJobs(hit.jobs);
        setListAvailableState(hit.listAvailable);
        setListHydrating(false);
        return;
      }
    }
    setRefreshing(true);
    if (!jobs.length) setListHydrating(true);
    try {
      const list = await officeListJobs();
      writeJobsCache(list);
      setJobs(list.jobs);
      setListAvailableState(list.listAvailable);
    } catch {
      /* keep cache */
    } finally {
      setRefreshing(false);
      setListHydrating(false);
    }
  };

  useEffect(() => {
    void softRefreshList(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per job open
  }, [jobId]);

  const onRefresh = async () => {
    setExplorerStatus("Refreshing…");
    await softRefreshList(true);
    setExplorerStatus(null);
  };

  const onLogout = async () => {
    await officeLogout();
    window.location.href = "/office";
  };

  const status =
    explorerStatus ||
    (listHydrating && !jobs.length ? "Loading jobs…" : null) ||
    (refreshing && jobs.length ? "Refreshing job list…" : null);

  const navigateUpLabel =
    folderSegments.length > 0 ? "Back to parent folder" : "Back to office job list";

  return (
    <OfficeChrome
      jobs={jobs}
      listAvailable={listAvailableState}
      selectedJobId={jobId}
      breadcrumbExtra={folderSegments}
      onRefresh={() => onRefresh().catch(() => {})}
      refreshing={refreshing}
      onJobsChanged={(next) => {
        setJobs(next);
        patchJobsCache(next, listAvailableState);
      }}
      onLogout={() => onLogout().catch(() => {})}
      statusMessage={status}
      onDownloadPackage={() => packageTriggerRef.current?.()}
      onNavigateUp={() => {
        if (navigateUpRef.current) {
          navigateUpRef.current();
          return;
        }
        void navigate({ to: "/office" });
      }}
      navigateUpLabel={navigateUpLabel}
    >
      <JobFileExplorer
        jobId={jobId}
        title={title}
        data={download}
        embedded
        onStatusChange={setExplorerStatus}
        onDisplayNameChange={(folderName) => {
          setTitleOverride(folderName);
          setJobs((prev) => {
            const next = prev.map((j) => (j.id === jobId ? { ...j, displayName: folderName } : j));
            patchJobsCache(next, listAvailableState);
            return next;
          });
        }}
        autoPackageDownload={autoPackageDownload}
        registerPackageDownload={(fn) => {
          packageTriggerRef.current = fn;
        }}
        registerNavigateUp={(fn) => {
          navigateUpRef.current = fn;
        }}
        onFolderPathChange={(segments) => {
          setFolderSegments((prev) => (prev.join("/") === segments.join("/") ? prev : segments));
        }}
      />
    </OfficeChrome>
  );
}
