const EXPORTS_LIST_URL = "https://visual-surveyor.lovable.app/api/public/exports-list";

export type OfficeJobFolder = {
  /** Top-level folder name (same id used by `/get?job=`). */
  id: string;
  fileCount: number;
  totalBytes: number;
};

export function exportsListTokenConfigured(): boolean {
  return Boolean(process.env.EXPORTS_LIST_TOKEN?.trim());
}

type ExportsListResponse = {
  jobs?: Array<{ id: string; fileCount: number; totalBytes: number }>;
};

/** Fetches job folders from the Lovable public exports-list API (server-only). */
export async function fetchExportJobListFromLovable(): Promise<
  { ok: true; jobs: OfficeJobFolder[] } | { ok: false; unauthorized: boolean }
> {
  const token = process.env.EXPORTS_LIST_TOKEN?.trim();
  if (!token) {
    return { ok: false, unauthorized: true };
  }

  const res = await fetch(EXPORTS_LIST_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    return { ok: false, unauthorized: true };
  }

  if (!res.ok) {
    throw new Error(`Exports list failed (${res.status}).`);
  }

  const body = (await res.json()) as ExportsListResponse;
  const jobs: OfficeJobFolder[] = [];
  for (const item of body.jobs ?? []) {
    const id = item.id?.trim();
    if (!id) continue;
    jobs.push({
      id,
      fileCount: Number(item.fileCount) || 0,
      totalBytes: Number(item.totalBytes) || 0,
    });
  }

  return { ok: true, jobs };
}
