import type { OfficeDownloadFile } from "@/server/office-download";

export type ExplorerEntry = {
  /** Full manifest zipPath / label */
  path: string;
  name: string;
  signedUrl: string;
  sizeBytes: number | null;
};

export function toExplorerEntries(files: OfficeDownloadFile[]): ExplorerEntry[] {
  return files.map((f) => ({
    path: f.label,
    name: f.label.split("/").pop() || f.label,
    signedUrl: f.signedUrl,
    sizeBytes: f.sizeBytes,
  }));
}

/** `dirPath` is empty at job root, or e.g. `distress` without trailing slash. */
export function listDirectory(
  entries: ExplorerEntry[],
  dirPath: string,
): { folders: string[]; files: ExplorerEntry[] } {
  const prefix = dirPath ? `${dirPath}/` : "";
  const folderSet = new Set<string>();
  const files: ExplorerEntry[] = [];

  for (const entry of entries) {
    if (dirPath && !entry.path.startsWith(prefix)) continue;
    const rest = dirPath ? entry.path.slice(prefix.length) : entry.path;
    if (!rest) continue;
    const slash = rest.indexOf("/");
    if (slash >= 0) {
      folderSet.add(rest.slice(0, slash));
    } else {
      files.push({ ...entry, name: rest });
    }
  }

  const folders = [...folderSet].sort((a, b) => a.localeCompare(b));
  files.sort((a, b) => a.name.localeCompare(b.name));
  return { folders, files };
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i;

export function isImageFileName(name: string): boolean {
  return IMAGE_EXT.test(name);
}

/** Reject path segments — job ids are UUIDs or similar single folder names. */
export function isSafeExportJobId(jobId: string): boolean {
  const id = jobId.trim();
  if (!id || id.length > 200) return false;
  if (id.includes("/") || id.includes("\\") || id.includes("..")) return false;
  return /^[a-zA-Z0-9._-]+$/.test(id);
}
