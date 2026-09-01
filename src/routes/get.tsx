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
      { name: "description", content: "Download a complete PGG field export as one ZIP from a single link." },
      { property: "og:title", content: "Download Export — PGG" },
      { property: "og:description", content: "Download a complete PGG field export as one ZIP from a single link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GetExport,
});

type Manifest = { version: number; folderName: string; files: { path: string; zipPath: string }[] };
type PartFile = { name: string; size: number };

function GetExport() {
  const { job } = Route.useSearch();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [parts, setParts] = useState<PartFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!job) {
      setError("No job link provided. Use the exact link shown on your phone.");
      return;
    }
    (async () => {
      // New raw-asset transfers carry a manifest; older ones are ZIP parts.
      const m = await supabase.storage.from("exports").download(`${job}/manifest.json`);
      if (m.data) {
        try {
          setManifest(JSON.parse(await m.data.text()) as Manifest);
          return;
        } catch {
          /* fall through to parts listing */
        }
      }
      const { data, error } = await supabase.storage.from("exports").list(job, { limit: 200 });
      if (error) return setError(error.message);
      const zips = (data || [])
        .filter((f) => f.name.endsWith(".zip"))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => ({ name: f.name, size: (f.metadata as any)?.size || 0 }));
      if (!zips.length) setError("Nothing found for this link. It may have expired, or the upload is still finishing on the phone.");
      else setParts(zips);
    })();
  }, [job]);

  const saveBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  // Assembles every uploaded file into a single ZIP here on the computer.
  const buildZip = async () => {
    if (!manifest) return;
    setBusy(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const root = zip.folder(manifest.folderName)!;
      for (let i = 0; i < manifest.files.length; i++) {
        const f = manifest.files[i];
        setStatus(`Downloading ${i + 1} of ${manifest.files.length}…`);
        let blob: Blob | null = null;
        for (let attempt = 0; attempt < 4 && !blob; attempt++) {
          const { data } = await supabase.storage.from("exports").download(`${job}/${f.path}`);
          if (data) blob = data;
          else await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
        if (!blob) throw new Error(`Could not download ${f.zipPath}`);
        root.file(f.zipPath, blob);
      }
      setStatus("Building ZIP…");
      const out = await zip.generateAsync({ type: "blob", compression: "STORE" });
      saveBlob(out, `${manifest.folderName}.zip`);
      setStatus("Done — check your downloads folder.");
    } catch (e: any) {
      setStatus(null);
      alert("Could not build the ZIP: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const downloadPart = async (name: string) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.storage.from("exports").download(`${job}/${name}`);
      if (error || !data) throw new Error(error?.message || "Download failed");
      saveBlob(data, name);
    } catch (e: any) {
      alert("Download failed: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number) => (n ? (n / 1024 / 1024).toFixed(1) + " MB" : "");

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui, sans-serif", color: "#2c241b" }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>PGG Export Download</h1>
      {error && <p style={{ color: "#a33", fontSize: 14 }}>{error}</p>}
      {!error && !manifest && !parts && <p style={{ fontSize: 14, color: "#6b5d4f" }}>Loading…</p>}

      {manifest && (
        <>
          <p style={{ fontSize: 14, color: "#6b5d4f", lineHeight: 1.5 }}>
            <strong>{manifest.folderName}</strong> — {manifest.files.length} files. Click below and your computer will
            download everything and save it as one ZIP, with the original folder structure.
          </p>
          <button
            onClick={buildZip}
            disabled={busy}
            style={{ width: "100%", padding: 14, margin: "12px 0", border: 0, borderRadius: 10, background: "#7a4b2a", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
          >
            {busy ? "Working…" : "Download everything as one ZIP"}
          </button>
          {status && <p style={{ fontSize: 13, color: "#6b5d4f" }}>{status}</p>}
        </>
      )}

      {parts && (
        <>
          <p style={{ fontSize: 14, color: "#6b5d4f", lineHeight: 1.5 }}>
            Download every part below into the <strong>same folder</strong>, then unzip them all there.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {parts.map((f) => (
              <li key={f.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #e5ddd2" }}>
                <span style={{ flex: 1, fontSize: 13, wordBreak: "break-all" }}>
                  {f.name}
                  <span style={{ color: "#6b5d4f" }}> {fmt(f.size)}</span>
                </span>
                <button
                  onClick={() => downloadPart(f.name)}
                  disabled={busy}
                  style={{ padding: "8px 14px", border: "1px solid #7a4b2a", borderRadius: 8, background: "#fff", color: "#7a4b2a", fontSize: 13, cursor: "pointer", flexShrink: 0 }}
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
