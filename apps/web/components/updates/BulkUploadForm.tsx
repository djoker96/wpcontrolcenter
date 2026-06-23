"use client";

import { useState, useEffect, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface Site {
  id: string;
  name: string;
  domain: string;
}

interface ScannedItem {
  name: string;
  slug: string;
  type: "plugin" | "theme";
  /** How many selected sites have this installed */
  matchCount: number;
  totalSites: number;
}

interface JobResult {
  siteName: string;
  success: boolean;
  jobId?: string;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Mock data for scan results                                         */
/* ------------------------------------------------------------------ */
function mockScan(sites: Site[]): ScannedItem[] {
  /* Simulate common plugins/themes found across selected sites */
  return [
    { name: "Yoast SEO", slug: "wordpress-seo", type: "plugin", matchCount: sites.length, totalSites: sites.length },
    { name: "Contact Form 7", slug: "contact-form-7", type: "plugin", matchCount: Math.max(1, sites.length - 1), totalSites: sites.length },
    { name: "WooCommerce", slug: "woocommerce", type: "plugin", matchCount: Math.max(1, sites.length - 2), totalSites: sites.length },
    { name: "Astra", slug: "astra", type: "theme", matchCount: sites.length, totalSites: sites.length },
    { name: "Elementor", slug: "elementor", type: "plugin", matchCount: Math.max(1, sites.length - 1), totalSites: sites.length },
  ];
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export function BulkUploadForm() {
  /* ─── Step tracking ─── */
  const [step, setStep] = useState(1);
  const maxStep = 4;

  /* ─── Step 1: Site selection ─── */
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* ─── Step 2: Scan results ─── */
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScannedItem | null>(null);

  /* ─── Step 3: File upload ─── */
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ─── Step 4: Results ─── */
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<JobResult[] | null>(null);

  /* Load sites on mount */
  useEffect(() => {
    const token = localStorage.getItem("wpcc_token");
    fetch("/api/sites", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => {
        const list: Site[] = res.data ?? (Array.isArray(res) ? res : []);
        setSites(list);
      })
      .catch(() => setSites([]));
  }, []);

  /* ─── Step actions ─── */
  const canNext = () => {
    if (step === 1) return selectedIds.size > 0;
    if (step === 2) return !!selectedItem;
    if (step === 3) return !!file;
    return true;
  };

  const handleNext = () => {
    if (step === 1) {
      setScanning(true);
      /* Simulate scan delay */
      setTimeout(() => {
        setScannedItems(mockScan(sites.filter((s) => selectedIds.has(s.id))));
        setScanning(false);
        setStep(2);
      }, 800);
      return;
    }
    if (step < maxStep) setStep((s) => s + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const toggleSite = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSites = () => {
    if (selectedIds.size === sites.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sites.map((s) => s.id)));
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const applyUpdate = async () => {
    if (!file || !selectedItem) return;
    setSaving(true);
    setResults(null);

    const siteIdsArr = Array.from(selectedIds);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("siteIds", JSON.stringify(siteIdsArr));
    fd.append("type", selectedItem.type);
    fd.append("slug", selectedItem.slug);

    try {
      const token = localStorage.getItem("wpcc_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/uploads/bulk", { method: "POST", headers, body: fd });
      const json = await res.json() as { success: boolean; jobs: { siteId: string; jobId: string }[] };

      const siteMap = new Map(sites.map((s) => [s.id, s.name]));
      setResults(
        json.jobs.map((j) => ({
          siteName: siteMap.get(j.siteId) || j.siteId,
          success: true,
          jobId: j.jobId,
        }))
      );
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err
        ? (err as { message: string }).message
        : "Upload failed";
      setResults(
        siteIdsArr.map((sid) => ({
          siteName: sites.find((s) => s.id === sid)?.name || sid,
          success: false,
          error: msg,
        }))
      );
    } finally {
      setSaving(false);
      setStep(4);
    }
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--border)]">
      {/* ── Stepper header ── */}
      <div className="flex items-center gap-[0] border-b border-[var(--border)]">
        {["Select sites", "Choose item", "Upload file", "Apply"].map((label, i) => {
          const idx = i + 1;
          const done = idx < step;
          const active = idx === step;
          return (
            <div
              key={label}
              className={`flex-1 flex items-center justify-center gap-[8px] h-[48px] text-[12.5px] font-semibold border-r last:border-r-0 border-[var(--border)] transition-colors ${
                active
                  ? "bg-[var(--primary)]/8 text-[var(--primary)]"
                  : done
                  ? "text-[var(--muted-foreground)]"
                  : "text-[var(--muted-foreground)]/60"
              }`}
            >
              <span className={`w-[20px] h-[20px] flex items-center justify-center text-[11px] font-bold rounded-full border ${
                active
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : done
                  ? "border-[var(--border)] bg-[var(--muted)]"
                  : "border-[var(--border)] bg-transparent"
              }`}>
                {done ? "✓" : idx}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </div>
          );
        })}
      </div>

      {/* ── Body ── */}
      <div className="p-[20px] text-[13px]">
        {/* ══════ Step 1: Select sites ══════ */}
        {step === 1 && (
          <div className="flex flex-col gap-[16px]">
            <p className="text-[13px] text-[var(--muted-foreground)]">
              Choose the sites you want to update, then scan them to find common plugins and themes.
            </p>
            {sites.length === 0 ? (
              <div className="text-[12.5px] text-[var(--muted-foreground)] py-[20px] text-center">Loading sites…</div>
            ) : (
              <div className="border border-[var(--border)]">
                <label className="flex items-center gap-[10px] px-[14px] py-[10px] border-b border-[var(--border)] cursor-pointer hover:bg-[var(--accent)]">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === sites.length}
                    onChange={toggleAllSites}
                    className="accent-[var(--primary)]"
                  />
                  <span className="font-semibold text-[13px]">All sites ({sites.length})</span>
                </label>
                <div className="max-h-[300px] overflow-y-auto divide-y divide-[var(--border)]">
                  {sites.map((site) => (
                    <label
                      key={site.id}
                      className="flex items-center gap-[10px] px-[14px] py-[10px] cursor-pointer hover:bg-[var(--accent)] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(site.id)}
                        onChange={() => toggleSite(site.id)}
                        className="accent-[var(--primary)]"
                      />
                      <div className="flex items-center gap-[8px] min-w-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="shrink-0 text-[var(--muted-foreground)]">
                          <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                        <span className="font-medium truncate">{site.name}</span>
                      </div>
                      <span className="text-[var(--muted-foreground)] ml-auto text-[12px]">{site.domain}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════ Step 2: Choose item ══════ */}
        {step === 2 && (
          <div className="flex flex-col gap-[16px]">
            {scanning ? (
              <div className="flex items-center justify-center gap-[10px] py-[40px] text-[var(--muted-foreground)]">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                Scanning {selectedIds.size} sites…
              </div>
            ) : (
              <>
                <p className="text-[13px] text-[var(--muted-foreground)]">
                  These plugins &amp; themes were found across your selected sites. Pick one to update.
                </p>
                <div className="border border-[var(--border)] divide-y divide-[var(--border)]">
                  {scannedItems.map((item) => (
                    <label
                      key={`${item.type}-${item.slug}`}
                      className={`flex items-center gap-[12px] px-[14px] py-[12px] cursor-pointer transition-colors hover:bg-[var(--accent)] ${
                        selectedItem?.slug === item.slug && selectedItem?.type === item.type ? "bg-[var(--primary)]/5" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="scan-item"
                        checked={selectedItem?.slug === item.slug && selectedItem?.type === item.type}
                        onChange={() => setSelectedItem(item)}
                        className="accent-[var(--primary)]"
                      />
                      <div className="flex items-center gap-[8px] min-w-0 flex-1">
                        <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${item.type === "plugin" ? "bg-[var(--info)]" : "bg-[var(--warning)]"}`} />
                        <span className="font-semibold text-[13px] truncate">{item.name}</span>
                        <span className={`text-[10px] font-semibold tracking-[0.04em] uppercase px-[6px] py-[1px] shrink-0 ${
                          item.type === "plugin" ? "bg-[var(--info)]/10 text-[var(--info)]" : "bg-[var(--warning)]/10 text-[var(--warning)]"
                        }`}>
                          {item.type}
                        </span>
                      </div>
                      <span className="text-[12px] text-[var(--muted-foreground)] shrink-0">
                        {item.matchCount}/{item.totalSites} sites
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════ Step 3: Upload file ══════ */}
        {step === 3 && (
          <div className="flex flex-col gap-[16px]">
            <div className="flex items-center gap-[8px] px-[14px] py-[10px] bg-[var(--muted)] text-[12.5px]">
              <span className="text-[var(--muted-foreground)]">Updating:</span>
              <span className="font-semibold">{selectedItem?.name}</span>
              <span className={`text-[10px] font-semibold uppercase px-[6px] py-[1px] ${
                selectedItem?.type === "plugin" ? "bg-[var(--info)]/10 text-[var(--info)]" : "bg-[var(--warning)]/10 text-[var(--warning)]"
              }`}>
                {selectedItem?.type}
              </span>
              <span className="text-[var(--muted-foreground)] ml-auto">{selectedIds.size} sites</span>
            </div>
            <p className="text-[13px] text-[var(--muted-foreground)]">
              Upload the new .zip file. It will be applied to <strong>{selectedItem?.name}</strong> across all {selectedIds.size} selected sites.
            </p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f && f.name.endsWith(".zip")) setFile(f); }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded p-[32px] text-center cursor-pointer transition-colors ${
                dragOver ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-[var(--border)] hover:border-[var(--primary)]"
              }`}
            >
              {file ? (
                <div className="flex flex-col items-center gap-[6px]">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span className="font-semibold text-[13px]">{file.name}</span>
                  <span className="text-[11.5px] text-[var(--muted-foreground)]">{formatSize(file.size)}</span>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-[11.5px] font-medium text-[var(--danger)] hover:underline">Remove</button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-[6px]">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-foreground)]">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
                  </svg>
                  <span className="font-semibold text-[13px]">Drop .zip file here or click to browse</span>
                  <span className="text-[11.5px] text-[var(--muted-foreground)]">Max 50 MB</span>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".zip" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} className="hidden" />
            </div>
          </div>
        )}

        {/* ══════ Step 4: Results ══════ */}
        {step === 4 && results && (
          <div className="flex flex-col gap-[12px]">
            {results.every((r) => r.success) ? (
              <div className="flex items-center gap-[8px] px-[14px] py-[10px] bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/30 text-[13px] font-semibold">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Update queued for all sites
              </div>
            ) : (
              <div className="flex items-center gap-[8px] px-[14px] py-[10px] bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/30 text-[13px] font-semibold">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                Some updates failed
              </div>
            )}
            <div className="border border-[var(--border)] divide-y divide-[var(--border)]">
              {results.map((r) => (
                <div key={r.siteName} className="flex items-center justify-between px-[14px] py-[10px] text-[12.5px]">
                  <span className="flex items-center gap-[8px]">
                    <span className={`w-[6px] h-[6px] rounded-full ${r.success ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`} />
                    <span className="font-medium">{r.siteName}</span>
                  </span>
                  <span className={r.success ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                    {r.success ? `Job #${r.jobId}` : r.error}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setStep(1); setFile(null); setResults(null); setSelectedItem(null); }}
              className="self-start h-[36px] px-[16px] border border-[var(--border)] font-semibold text-[12.5px] hover:bg-[var(--accent)]"
            >
              Start new bulk update
            </button>
          </div>
        )}
      </div>

      {/* ── Footer navigation ── */}
      {step < 4 && (
        <div className="flex items-center justify-between px-[20px] h-[60px] border-t border-[var(--border)]">
          <button
            onClick={handlePrev}
            disabled={step === 1}
            className="h-[36px] px-[14px] border border-[var(--border)] text-[12.5px] font-semibold disabled:opacity-30 hover:bg-[var(--accent)]"
          >
            Back
          </button>
          <div className="flex items-center gap-[8px]">
            <span className="text-[11.5px] text-[var(--muted-foreground)]">Step {step} of {maxStep - 1}</span>
            {step === 3 ? (
              <button
                onClick={applyUpdate}
                disabled={!file || saving || !selectedItem}
                className="h-[36px] px-[18px] bg-[var(--primary)] text-[var(--primary-foreground)] text-[12.5px] font-semibold disabled:opacity-50 hover:opacity-90 inline-flex items-center gap-[6px]"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Applying…
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    Apply Update
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!canNext() || scanning}
                className="h-[36px] px-[18px] bg-[var(--primary)] text-[var(--primary-foreground)] text-[12.5px] font-semibold disabled:opacity-50 hover:opacity-90 inline-flex items-center gap-[6px]"
              >
                {step === 2 && scanning ? "Scanning…" : step === 1 ? "Scan sites" : "Next"}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
