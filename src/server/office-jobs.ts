export type OfficeJobFolder = {
  /** Top-level folder name in the `exports` bucket (same id used by `/get?job=`). */
  id: string;
  updatedAt: string | null;
};

export function supabaseAdminConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

/** Lists job folders at the root of the Supabase `exports` bucket (server-only). */
export async function listExportJobFolders(): Promise<OfficeJobFolder[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const jobs: OfficeJobFolder[] = [];
  const limit = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabaseAdmin.storage.from("exports").list("", {
      limit,
      offset,
      sortBy: { column: "name", order: "desc" },
    });

    if (error) {
      throw new Error(error.message || "Could not list export jobs.");
    }

    const page = data ?? [];
    for (const item of page) {
      // Folders have no object id; skip stray root files.
      if (item.id !== null) continue;
      const name = item.name?.trim();
      if (!name) continue;
      const updated =
        (item.updated_at as string | undefined) ??
        (item.metadata as { updated_at?: string } | undefined)?.updated_at ??
        null;
      jobs.push({ id: name, updatedAt: updated });
    }

    if (page.length < limit) break;
    offset += limit;
  }

  return jobs;
}
