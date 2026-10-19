import { useEffect, useMemo, useRef, useState } from "react";
import { officeGetJobPins, officeUpdateJobPins } from "@/lib/office-mutate.functions";
import type { OfficePinNote } from "@/lib/office-pins";
import { OFFICE_BTN_CLASS, PGG } from "@/components/office/OfficeChrome";

type Props = {
  jobId: string;
  source?: "blobs" | "lovable" | null;
  open: boolean;
  onClose: () => void;
  onStatusChange?: (message: string | null) => void;
};

function formatEditedAt(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Phase A — edit pin descriptions / notes for a synced job.
 * Full-screen editor with browser spellcheck; saves pins.csv via Lovable exports-pins.
 */
export function OfficePinNotesEditor({
  jobId,
  source = null,
  open,
  onClose,
  onStatusChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pins, setPins] = useState<OfficePinNote[]>([]);
  const [editedAt, setEditedAt] = useState<string | null>(null);
  const [csvMissing, setCsvMissing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [fullscreenDraft, setFullscreenDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const statusRef = useRef(onStatusChange);
  statusRef.current = onStatusChange;

  const setStatus = (msg: string | null) => statusRef.current?.(msg);

  const dirtyKeys = useMemo(() => {
    const dirty = new Set<string>();
    for (const p of pins) {
      const key = p.pinId || p.pinNum;
      if ((drafts[key] ?? p.description) !== p.description) dirty.add(key);
    }
    return dirty;
  }, [pins, drafts]);

  const dirtyCount = dirtyKeys.size;

  const load = async () => {
    setLoading(true);
    setError(null);
    setStatus("Loading pin notes…");
    try {
      const payload = await officeGetJobPins({ data: { jobId, source } });
      setPins(payload.pins);
      setEditedAt(payload.officeNotesEditedAt);
      setCsvMissing(!payload.csvPath || payload.pins.length === 0);
      const next: Record<string, string> = {};
      for (const p of payload.pins) {
        next[p.pinId || p.pinNum] = p.description;
      }
      setDrafts(next);
      setActiveKey(null);
      setStatus(
        payload.pins.length
          ? `Loaded ${payload.pins.length} pin note${payload.pins.length === 1 ? "" : "s"}`
          : "No pins.csv on this job",
      );
      window.setTimeout(() => setStatus(null), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load pin notes.";
      setError(msg);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when opened for this job
  }, [open, jobId]);

  useEffect(() => {
    if (!open || !activeKey) return;
    const t = window.setTimeout(() => textareaRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, activeKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeKey) {
          setActiveKey(null);
        } else if (!saving) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, activeKey, saving, onClose]);

  if (!open) return null;

  const openFullscreen = (pin: OfficePinNote) => {
    const key = pin.pinId || pin.pinNum;
    setFullscreenDraft(drafts[key] ?? pin.description);
    setActiveKey(key);
  };

  const closeFullscreen = (commit: boolean) => {
    if (activeKey && commit) {
      setDrafts((prev) => ({ ...prev, [activeKey]: fullscreenDraft }));
    }
    setActiveKey(null);
  };

  const onSaveAll = async () => {
    if (dirtyCount === 0 || saving) return;
    setSaving(true);
    setError(null);
    setStatus("Saving pin notes…");
    try {
      const updates = pins
        .filter((p) => dirtyKeys.has(p.pinId || p.pinNum))
        .map((p) => {
          const key = p.pinId || p.pinNum;
          return {
            pinId: p.pinId.startsWith("row-") ? undefined : p.pinId,
            pinNum: p.pinNum,
            description: drafts[key] ?? p.description,
          };
        });
      const payload = await officeUpdateJobPins({ data: { jobId, source, updates } });
      setPins(payload.pins);
      setEditedAt(payload.officeNotesEditedAt);
      const next: Record<string, string> = {};
      for (const p of payload.pins) {
        next[p.pinId || p.pinNum] = p.description;
      }
      setDrafts(next);
      setStatus("Pin notes saved to staging");
      window.setTimeout(() => setStatus(null), 2400);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save pin notes.";
      setError(msg);
      setStatus(null);
    } finally {
      setSaving(false);
    }
  };

  const onCloseClick = () => {
    if (dirtyCount > 0 && !window.confirm("Discard unsaved note changes?")) return;
    onClose();
  };

  const editedLabel = formatEditedAt(editedAt);
  const activePin = activeKey ? pins.find((p) => (p.pinId || p.pinNum) === activeKey) : null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Edit pin notes"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: PGG.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: '"Segoe UI", "Segoe UI Variable", system-ui, sans-serif',
        color: PGG.ink,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: `1px solid ${PGG.line}`,
          background: PGG.paper,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className={OFFICE_BTN_CLASS}
          onClick={onCloseClick}
          disabled={saving}
          style={ghostBtn}
        >
          Close
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Edit pin notes</div>
          <div style={{ fontSize: 11, color: PGG.muted, lineHeight: 1.35 }}>
            Fix typos on the desk · browser spellcheck on
            {editedLabel ? ` · Last office edit ${editedLabel}` : ""}
          </div>
        </div>
        <button
          type="button"
          className={`${OFFICE_BTN_CLASS} office-btn-primary${saving ? " is-busy" : ""}${dirtyCount === 0 ? " is-disabled" : ""}`}
          onClick={() => void onSaveAll()}
          disabled={saving || dirtyCount === 0 || loading}
          style={{
            ...primaryBtn,
            opacity: dirtyCount === 0 ? 0.55 : 1,
          }}
        >
          {saving ? "Saving…" : dirtyCount ? `Save ${dirtyCount}` : "Saved"}
        </button>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            margin: "8px 12px 0",
            padding: "8px 10px",
            background: "#fdf4e0",
            border: "1px solid #f0dfae",
            color: "#5c4210",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          {error.includes("404") || error.toLowerCase().includes("publish") ? (
            <>
              <strong>Can&apos;t save yet.</strong> {error} After Lovable Publish of{" "}
              <code>/api/public/exports-pins</code>, reopen this job and try Save again. Open /
              Download / Delete still work.
            </>
          ) : (
            error
          )}
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", padding: "10px 12px 24px" }}>
        {loading && (
          <p style={{ color: PGG.muted, fontSize: 13, fontWeight: 600 }}>Loading notes…</p>
        )}

        {!loading && csvMissing && !error && (
          <p style={{ color: PGG.muted, fontSize: 13, lineHeight: 1.45 }}>
            No <code>pins.csv</code> on this job yet. Sync from the field phone first, then edit
            notes here.
          </p>
        )}

        {!loading && pins.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {pins.map((pin) => {
              const key = pin.pinId || pin.pinNum;
              const draft = drafts[key] ?? pin.description;
              const dirty = dirtyKeys.has(key);
              const preview = draft.trim() || "(no description)";
              return (
                <li
                  key={key}
                  style={{
                    border: `1px solid ${PGG.line}`,
                    background: PGG.paper,
                    marginBottom: 8,
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 14,
                        color: PGG.accent,
                        minWidth: 28,
                      }}
                    >
                      #{pin.pinNum}
                    </span>
                    {dirty && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: PGG.accent }}>
                        Edited
                      </span>
                    )}
                    <button
                      type="button"
                      className={`${OFFICE_BTN_CLASS} office-btn-linkish`}
                      onClick={() => openFullscreen(pin)}
                      style={{
                        marginLeft: "auto",
                        border: 0,
                        background: "transparent",
                        color: PGG.accent,
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                        padding: "2px 4px",
                      }}
                    >
                      Edit full screen
                    </button>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      lineHeight: 1.45,
                      color: draft.trim() ? PGG.ink : PGG.muted,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {preview.length > 220 ? `${preview.slice(0, 220)}…` : preview}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {activePin && activeKey && (
        <div
          role="dialog"
          aria-modal
          aria-label={`Edit pin ${activePin.pinNum}`}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            background: PGG.paper,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderBottom: `1px solid ${PGG.line}`,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              className={OFFICE_BTN_CLASS}
              onClick={() => closeFullscreen(false)}
              style={ghostBtn}
            >
              Cancel
            </button>
            <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
              Pin #{activePin.pinNum} — description
            </div>
            <button
              type="button"
              className={`${OFFICE_BTN_CLASS} office-btn-primary`}
              onClick={() => closeFullscreen(true)}
              style={primaryBtn}
            >
              Done
            </button>
          </header>
          <label
            htmlFor="office-pin-note"
            style={{
              display: "block",
              padding: "8px 12px 0",
              fontSize: 12,
              color: PGG.muted,
              fontWeight: 600,
            }}
          >
            Spellcheck uses your browser dictionary
          </label>
          <textarea
            id="office-pin-note"
            ref={textareaRef}
            value={fullscreenDraft}
            onChange={(e) => setFullscreenDraft(e.target.value)}
            spellCheck
            lang="en"
            autoCapitalize="sentences"
            autoCorrect="on"
            placeholder="Describe what you see…"
            style={{
              flex: 1,
              margin: "8px 12px 16px",
              padding: "14px 16px",
              border: `1px solid ${PGG.line}`,
              borderRadius: 2,
              fontSize: 17,
              lineHeight: 1.55,
              fontFamily: "inherit",
              color: PGG.ink,
              background: PGG.bg,
              resize: "none",
              outline: "none",
            }}
          />
        </div>
      )}
    </div>
  );
}

const ghostBtn = {
  padding: "6px 12px",
  border: `1px solid ${PGG.line}`,
  borderRadius: 2,
  background: PGG.paper,
  color: PGG.ink,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
} as const;

const primaryBtn = {
  padding: "6px 14px",
  border: `1px solid ${PGG.accent}`,
  borderRadius: 2,
  background: PGG.accent,
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
} as const;
