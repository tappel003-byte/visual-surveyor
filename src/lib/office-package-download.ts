import { officeGetJobDownload, officeSignFile } from "@/lib/office-download.functions";

/** List Download sets this before navigating to the job page (token/sign package ZIP). */
export const OFFICE_AUTO_PACKAGE_KEY = "pgg_office_auto_package";

export type OfficePackageFile = {
  path: string;
  label: string;
};

/** Plain-English download failures for desk staff. */
export function plainOfficeDownloadFailure(err: unknown): string {
  const raw = String(err instanceof Error ? err.message : err || "").toLowerCase();
  if (raw.includes("sign in") || raw.includes("unauthorized") || raw.includes("session")) {
    return "Sign in at /office with the company password, then try Download again.";
  }
  if (raw.includes("exports_list_token") || raw.includes("not configured") || raw.includes("unauthorized")) {
    return (
      "Download isn’t available right now. Tell whoever runs the Netlify site to check the shared office list token " +
      "and Publish once in Lovable. Do not add storage service keys on Netlify."
    );
  }
  if (raw.includes("network") || raw.includes("fetch") || raw.includes("failed to fetch")) {
    return "Couldn’t download. Check your internet, then try Download again.";
  }
  return "Couldn’t download this job. Open the job, try Download package again, or download files one at a time. Photos stay in staging until Delete.";
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Desk package download via Lovable token/sign path (EXPORTS_LIST_TOKEN).
 * Assembles a ZIP in the browser — Netlify never streams the job body.
 */
export async function downloadOfficeJobPackage(opts: {
  jobId: string;
  folderName?: string | null;
  files?: OfficePackageFile[];
  onProgress?: (message: string) => void;
}): Promise<void> {
  const jobId = opts.jobId.trim();
  if (!jobId) throw new Error("No job selected.");

  let files = opts.files?.filter((f) => f.path && f.label) ?? [];
  let folderName = opts.folderName?.trim() || null;

  if (!files.length) {
    opts.onProgress?.("Loading file list…");
    const payload = await officeGetJobDownload({ data: { jobId } });
    if (!payload.storageLinksAvailable) {
      throw new Error("EXPORTS_LIST_TOKEN is not configured.");
    }
    if (!payload.files.length) {
      throw new Error("No files found for this job yet.");
    }
    files = payload.files.map((f) => ({ path: f.path, label: f.label }));
    folderName = payload.folderName || folderName;
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const rootName = folderName || "field-export";
  const root = zip.folder(rootName);
  if (!root) throw new Error("Could not start the download package.");

  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    opts.onProgress?.(`Downloading ${i + 1} of ${files.length}…`);
    let signedUrl: string | null = null;
    for (let attempt = 0; attempt < 3 && !signedUrl; attempt++) {
      try {
        const signed = await officeSignFile({ data: { jobId, path: f.path } });
        signedUrl = signed.signedUrl;
      } catch (err) {
        if (attempt === 2) throw err;
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    if (!signedUrl) throw new Error(`Could not prepare ${f.label}`);

    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 4 && !blob; attempt++) {
      try {
        const res = await fetch(signedUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        blob = await res.blob();
      } catch {
        if (attempt === 3) throw new Error(`Could not download ${f.label}`);
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    if (!blob) throw new Error(`Could not download ${f.label}`);
    root.file(f.label, blob);
  }

  opts.onProgress?.("Building ZIP…");
  const out = await zip.generateAsync({ type: "blob", compression: "STORE" });
  saveBlob(out, `${rootName}.zip`);
  opts.onProgress?.("Done — check your downloads folder.");
}
