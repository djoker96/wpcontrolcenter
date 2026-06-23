"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api-client";

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */
interface Props {
  open: boolean;
  onClose: () => void;
  siteId: string;
  siteName: string;
  /** Pre-select type when opening from a specific row */
  presetType?: "plugin" | "theme";
  /** Pre-fill slug (for plugin) */
  presetSlug?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export function UploadUpdateDrawer({ open, onClose, siteId, siteName, presetType, presetSlug }: Props) {
  const [type, setType] = useState<"plugin" | "theme">("plugin");
  const [slug, setSlug] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ ok: boolean; jobId?: string; message?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* Apply presets when drawer opens */
  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => {
      setType(presetType ?? "plugin");
      setSlug(presetSlug ?? "");
      setFile(null);
      setDragOver(false);
      setSaving(false);
      setSaved(null);
    });
  }, [open, presetType, presetSlug]);

  /* ESC to close */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.endsWith(".zip")) setFile(f);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = async () => {
    if (!file) return;
    setSaving(true);
    setSaved(null);

    try {
      const actionPath = type === "plugin" ? `/sites/${siteId}/actions/upload-plugin` : `/sites/${siteId}/actions/upload-theme`;
      const result = await api.uploadFile<{ success: boolean; jobId: string }>(
        actionPath,
        file,
        type === "plugin" ? slug || undefined : undefined,
      );
      setSaved({ ok: true, jobId: result.jobId });
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err
        ? (err as { message: string }).message
        : "Upload failed";
      setSaved({ ok: false, message: msg });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 z-50 h-full w-[420px] bg-[var(--card)] border-l border-[var(--border)] shadow-lg flex flex-col"
        style={{ animation: "slideIn 200ms ease-out" }}
      >
        {/* -------- Header -------- */}
        <div className="flex items-center justify-between px-[18px] h-[56px] border-b border-[var(--border)] flex-none">
          <span className="font-heading font-bold text-[16px]">
            Upload {presetType ?? "update"}
          </span>
          <button
            onClick={onClose}
            className="w-[32px] h-[32px] flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* -------- Body -------- */}
        <div className="flex-1 overflow-y-auto px-[18px] py-[16px] flex flex-col gap-[20px] text-[13px]">
          {/* Site info */}
          <div className="bg-[var(--muted)] px-[14px] py-[10px] text-[12.5px]">
            <span className="text-[var(--muted-foreground)]">Site: </span>
            <span className="font-semibold">{siteName}</span>
          </div>

          {/* If opened from a specific row, show read-only summary instead of type selector */}
          {presetType ? (
            <div className="border border-[var(--border)] px-[14px] py-[12px]">
              <div className="text-[11px] font-semibold tracking-[0.03em] uppercase text-[var(--muted-foreground)] mb-[4px]">
                Update target
              </div>
              <div className="flex items-center gap-[8px]">
                <span className={`text-[10.5px] font-semibold uppercase px-[6px] py-[2px] ${
                  presetType === "plugin"
                    ? "bg-[var(--info)]/10 text-[var(--info)]"
                    : "bg-[var(--warning)]/10 text-[var(--warning)]"
                }`}>
                  {presetType}
                </span>
                <span className="font-semibold text-[13px]">{presetSlug || "(no slug)"}</span>
              </div>
            </div>
          ) : (
            <>
              {/* Type selector — only show when no preset */}
              <Field label="Update type">
                <div className="flex gap-[6px]">
                  {(["plugin", "theme"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={`h-[32px] px-[16px] text-[12.5px] font-semibold border transition-colors ${
                        type === t
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                          : "bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--accent)]"
                      }`}
                    >
                      {t === "plugin" ? "Plugin" : "Theme"}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Slug (plugin only) */}
              {type === "plugin" && (
                <Field label="Plugin slug">
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. wordpress-seo"
                    className="w-full h-[36px] px-[11px] bg-[var(--background)] border border-[var(--border)] text-[13px] font-medium outline-none focus:border-[var(--primary)]"
                  />
                  <div className="text-[11px] text-[var(--muted-foreground)] mt-[4px]">
                    The plugin slug from WordPress directory.
                  </div>
                </Field>
              )}
            </>
          )}

          {/* File upload */}
          <Field label="Upload .zip file">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded p-[24px] text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-[var(--primary)] bg-[var(--primary)]/5"
                  : "border-[var(--border)] hover:border-[var(--primary)]"
              }`}
            >
              {file ? (
                <div className="flex flex-col items-center gap-[6px]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span className="font-semibold text-[13px]">{file.name}</span>
                  <span className="text-[11.5px] text-[var(--muted-foreground)]">{formatSize(file.size)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="text-[11.5px] font-medium text-[var(--danger)] hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-[6px]">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-foreground)]">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
                  </svg>
                  <span className="font-semibold text-[13px]">Drop .zip file here or click to browse</span>
                  <span className="text-[11.5px] text-[var(--muted-foreground)]">Max 50 MB</span>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </Field>

          {/* Success / Error feedback */}
          {saved && (
            <div className={`px-[14px] py-[10px] text-[12.5px] ${
              saved.ok
                ? "bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/30"
                : "bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/30"
            }`}>
              {saved.ok
                ? <>✓ Update queued — Job ID: <span className="font-mono font-semibold">{saved.jobId}</span></>
                : <>✗ {saved.message}</>
              }
            </div>
          )}
        </div>

        {/* -------- Footer -------- */}
        <div className="flex items-center justify-end gap-[8px] px-[18px] h-[60px] border-t border-[var(--border)] flex-none">
          <button
            onClick={onClose}
            className="h-[36px] px-[14px] border border-[var(--border)] text-[12.5px] font-semibold hover:bg-[var(--accent)]"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || saving || (type === "plugin" && !slug.trim())}
            className="h-[36px] px-[18px] bg-[var(--primary)] text-[var(--primary-foreground)] text-[12.5px] font-semibold disabled:opacity-50 hover:opacity-90 inline-flex items-center gap-[6px]"
          >
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Uploading…
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
                </svg>
                Upload &amp; Update
              </>
            )}
          </button>
        </div>
      </div>

      {/* Slide-in keyframe */}
      <style dangerouslySetInnerHTML={{
        __html: `@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`,
      }} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Field wrapper                                                     */
/* ------------------------------------------------------------------ */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-heading font-semibold text-[12.5px] tracking-[0.03em] uppercase text-[var(--muted-foreground)] mb-[8px]">
        {label}
      </div>
      {children}
    </div>
  );
}
