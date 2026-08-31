import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/get")({
  validateSearch: (search: Record<string, unknown>) => ({
    job: typeof search.job === "string" ? search.job : "",
  }),
  head: () => ({
    meta: [
      { title: "Download Export — PGG" },
      { name: "description", content: "Download all parts of a PGG field export from one link." },
      { property: "og:title", content: "Download Export — PGG" },
      { property: "og:description", content: "Download all parts of a PGG field export from one link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GetExport,
});

type PartFile = { name: string; size: number };

function GetExport() {
  const { job } = Route.useSearch();
  const [files, setFiles] = useState<PartFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!job) {
      setError("No job link provided. Use the exact link shown on your phone.");
      return;
    }
    (async () => {
      const { data, error } = await supabase.storage.from("exports").list(job, { limit: 100 });
      if (error) {
        setError(error.message);
        return;
      }
      const zips = (data || [])
        .filter((f) => f.name.endsWith(".zip"))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => ({ name: f.name, size: (f.metadata as any)?.size || 0 }));
      if (!zips.length) setError("No files found for this link. It may have expired or already been cleaned up.");
      else setFiles(zips);
    })();
  }, [job]);

  const downloadOne = async (name: string) => {
    setBusy(name);
    try {
      const { data, error } = await supabase.storage.from("exports").download(`${job}/${name}`);
      if (error || !data) throw new Error(error?.message || "Download failed");
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e: any) {
      alert("Download failed: " + (e?.message || e));
    } finally {
      setBusy(null);
    }
  };

  const downloadAll = async () => {
    if (!files) return;
    for (const f of files) {
      // Sequential so the browser doesn't block a burst of downloads.
      await downloadOne(f.name);
      await new Promise((r) => setTimeout(r, 600));
    }
  };

  const fmt = (n: number) => (n ? (n / 1024 / 1024).toFixed(1) + " MB" : "");

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui, sans-serif", color: "#2c241b" }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>PGG Export Download</h1>
      <p style={{ fontSize: 14, color: "#6b5d4f", lineHeight: 1.5 }}>
        Download every part below into the <strong>same folder</strong>, then unzip them all there.
        Each part contains the same top-level folder, so your photos, CSVs, plan, and PDF rebuild exactly.
        Files are kept for a limited time, so download them soon.
      </p>
      {error && <p style={{ color: "#a33", fontSize: 14 }}>{error}</p>}
      {!error && !files && <p style={{ fontSize: 14, color: "#6b5d4f" }}>Loading…</p>}
      {files && (
        <>
          <button
            onClick={downloadAll}
            disabled={!!busy}
            style={{ width: "100%", padding: 14, margin: "12px 0", border: 0, borderRadius: 10, background: "#7a4b2a", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
          >
            {busy ? "Downloading…" : `Download all ${files.length} parts`}
          </button>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {files.map((f) => (
              <li key={f.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #e5ddd2" }}>
                <span style={{ flex: 1, fontSize: 13, wordBreak: "break-all" }}>
                  {f.name}
                  <span style={{ color: "#6b5d4f" }}> {fmt(f.size)}</span>
                </span>
                <button
                  onClick={() => downloadOne(f.name)}
                  disabled={!!busy}
                  style={{ padding: "8px 14px", border: "1px solid #7a4b2a", borderRadius: 8, background: "#fff", color: "#7a4b2a", fontSize: 13, cursor: "pointer", flexShrink: 0 }}
                >
                  {busy === f.name ? "…" : "Download"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
