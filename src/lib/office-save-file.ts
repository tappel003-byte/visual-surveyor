/** File System Access Save As helpers for office Download (Chromium). */

export type OfficeSaveOutcome =
  | { kind: "saved"; mode: "picker" | "fallback"; filename: string; message: string }
  | { kind: "cancelled" };

type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
  excludeAcceptAllOption?: boolean;
};

type SaveFileHandle = {
  name: string;
  createWritable: () => Promise<FileSystemWritableFileStream>;
};

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<SaveFileHandle>;
};

export function supportsSaveFilePicker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as SaveFilePickerWindow).showSaveFilePicker === "function"
  );
}

export function isSaveCancelled(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return (err as { name?: string }).name === "AbortError";
}

export function fallbackSaveMessage(filename: string): string {
  return (
    `Saved as ${filename} — if you don’t see a Save dialog, check Chrome Downloads (Ctrl+J) ` +
    `or turn on Ask where to save in Chrome settings.`
  );
}

export function pickerSavedMessage(filename: string): string {
  return `Saved as ${filename}.`;
}

/** Open Save As and return a writable stream. Throws AbortError on cancel. */
export async function openSaveWritable(
  suggestedName: string,
  mimeType: string,
  extension: string,
): Promise<{ filename: string; writable: FileSystemWritableFileStream }> {
  const w = window as SaveFilePickerWindow;
  if (!w.showSaveFilePicker) {
    throw new Error("Save As is not available in this browser.");
  }
  const ext = extension.startsWith(".") ? extension : extension ? `.${extension}` : "";
  const handle = await w.showSaveFilePicker({
    suggestedName,
    excludeAcceptAllOption: false,
    types: [
      {
        description: ext === ".zip" ? "ZIP package" : "File",
        accept: { [mimeType]: ext ? [ext] : [] },
      },
    ],
  });
  const writable = await handle.createWritable();
  return { filename: handle.name || suggestedName, writable };
}

/** Silent `<a download>` fallback when Save As is unavailable. */
export function triggerAnchorDownload(blob: Blob, filename: string): void {
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
 * Save one blob: Save As dialog in Chromium, else anchor download + clear message.
 * Cancel → `{ kind: "cancelled" }` (caller must not claim success).
 */
export async function saveBlobWithSaveAs(
  blob: Blob,
  suggestedName: string,
  opts?: { mimeType?: string; extension?: string },
): Promise<OfficeSaveOutcome> {
  const mimeType = opts?.mimeType || blob.type || "application/octet-stream";
  const extension =
    opts?.extension ||
    (suggestedName.includes(".") ? `.${suggestedName.split(".").pop()}` : "");

  if (supportsSaveFilePicker()) {
    try {
      const { filename, writable } = await openSaveWritable(suggestedName, mimeType, extension || "");
      try {
        await blob.stream().pipeTo(writable);
      } catch (err) {
        try {
          await writable.abort();
        } catch {
          /* ignore */
        }
        throw err;
      }
      return {
        kind: "saved",
        mode: "picker",
        filename,
        message: pickerSavedMessage(filename),
      };
    } catch (err) {
      if (isSaveCancelled(err)) return { kind: "cancelled" };
      throw err;
    }
  }

  triggerAnchorDownload(blob, suggestedName);
  return {
    kind: "saved",
    mode: "fallback",
    filename: suggestedName,
    message: fallbackSaveMessage(suggestedName),
  };
}
