"use client";

import { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface CheckConfig {
  frequency: number;       // minutes
  method: "GET" | "HEAD";
  expectedStatus: number;
  timeout: number;         // seconds
  checkSSL: boolean;
  sslFrequency: "6h" | "12h" | "24h";
  alertEmail: boolean;
  scope: "all" | "selected";
  selectedSiteIds: string[];
}

interface Site {
  id: string;
  name: string;
  domain: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Defaults                                                          */
/* ------------------------------------------------------------------ */
const DEFAULTS: CheckConfig = {
  frequency: 5,
  method: "GET",
  expectedStatus: 200,
  timeout: 10,
  checkSSL: true,
  sslFrequency: "24h",
  alertEmail: true,
  scope: "all",
  selectedSiteIds: [],
};

const FREQ_OPTIONS = [
  { label: "Every 1 minute", value: 1 },
  { label: "Every 5 minutes", value: 5 },
  { label: "Every 15 minutes", value: 15 },
  { label: "Every 30 minutes", value: 30 },
  { label: "Every 60 minutes", value: 60 },
];

const TIMEOUT_OPTIONS = [5, 10, 30, 60];
const SSL_FREQ_OPTIONS = [
  { label: "Every 6 hours", value: "6h" as const },
  { label: "Every 12 hours", value: "12h" as const },
  { label: "Every 24 hours", value: "24h" as const },
];

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export function ConfigureChecksDrawer({ open, onClose }: Props) {
  const [config, setConfig] = useState<CheckConfig>({ ...DEFAULTS });
  const [sites, setSites] = useState<Site[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /* Load site list when opened */
  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => setSaved(false));
    fetch(`${API_URL}/sites`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => {
        const list: Site[] =
          res.data ??
          (Array.isArray(res) ? res : []);
        setSites(list);
      })
      .catch(() => setSites([
        { id: "1", name: "acme-corp.com", domain: "acme-corp.com" },
        { id: "2", name: "bluewave.io", domain: "bluewave.io" },
        { id: "3", name: "shop.northstar.co", domain: "shop.northstar.co" },
        { id: "4", name: "lotus-clinic.vn", domain: "lotus-clinic.vn" },
        { id: "5", name: "nordic-travel.no", domain: "nordic-travel.no" },
        { id: "6", name: "pixel-studio.co", domain: "pixel-studio.co" },
      ]));
  }, [open]);

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

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  const toggleSite = (id: string) => {
    setConfig((c) => ({
      ...c,
      selectedSiteIds: c.selectedSiteIds.includes(id)
        ? c.selectedSiteIds.filter((s) => s !== id)
        : [...c.selectedSiteIds, id],
    }));
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 z-50 h-full w-[420px] bg-[var(--card)] border-l border-[var(--border)] shadow-lg flex flex-col animate-in slide-in-from-right duration-200"
        style={{ animation: "slideIn 200ms ease-out" }}
      >
        {/* -------- Header -------- */}
        <div className="flex items-center justify-between px-[18px] h-[56px] border-b border-[var(--border)] flex-none">
          <span className="font-heading font-bold text-[16px]">Configure checks</span>
          <button
            onClick={onClose}
            className="w-[32px] h-[32px] flex items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* -------- Body -------- */}
        <div className="flex-1 overflow-y-auto px-[18px] py-[16px] flex flex-col gap-[20px] text-[13px]">

          {/* Check frequency */}
          <Field label="Check frequency">
            <div className="flex flex-wrap gap-[6px]">
              {FREQ_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setConfig((c) => ({ ...c, frequency: opt.value }))}
                  className={`h-[32px] px-[12px] text-[12.5px] font-semibold border transition-colors ${
                    config.frequency === opt.value
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                      : "bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--accent)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          {/* HTTP method */}
          <Field label="HTTP method" tooltip="Phương thức HTTP dùng để kiểm tra. GET tải toàn bộ trang web (kiểm tra nội dung lẫn server). HEAD chỉ lấy header (nhanh hơn, chỉ kiểm tra server có hoạt động không). Nên dùng GET để kiểm tra toàn diện.">
            <div className="flex gap-[6px]">
              {(["GET", "HEAD"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setConfig((c) => ({ ...c, method: m }))}
                  className={`h-[32px] px-[16px] text-[12.5px] font-semibold border transition-colors ${
                    config.method === m
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                      : "bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--accent)]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>

          {/* Expected status + Timeout row */}
          <div className="grid grid-cols-2 gap-[14px]">
            <Field label="Expected status" tooltip="Mã trạng thái HTTP mong đợi khi kiểm tra. 200 = OK (trang hoạt động bình thường). 301/302 = chuyển hướng. 404 = không tìm thấy trang. 500 = lỗi server. Nếu server trả về mã khác với mã này, hệ thống sẽ báo cảnh báo.">
              <input
                type="number"
                value={config.expectedStatus}
                onChange={(e) => setConfig((c) => ({ ...c, expectedStatus: Number(e.target.value) || 200 }))}
                className="w-full h-[36px] px-[11px] bg-[var(--background)] border border-[var(--border)] text-[13px] font-medium outline-none focus:border-[var(--primary)]"
              />
            </Field>
            <Field label="Timeout" tooltip="Thời gian tối đa chờ server phản hồi (tính bằng giây). Nếu server không phản hồi trong khoảng thời gian này, hệ thống sẽ coi như kiểm tra thất bại. 5s = nhanh, phù hợp server khỏe. 60s = chậm, phù hợp server có tài nguyên yếu.">
              <div className="flex gap-[4px] flex-wrap">
                {TIMEOUT_OPTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setConfig((c) => ({ ...c, timeout: t }))}
                    className={`h-[32px] px-[10px] text-[12px] font-semibold border transition-colors ${
                      config.timeout === t
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                        : "bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--accent)]"
                    }`}
                  >
                    {t}s
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* SSL check */}
          <div className="border border-[var(--border)] p-[14px]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-[13px]">SSL certificate check</div>
                <div className="text-[12px] text-[var(--muted-foreground)] mt-[1px]">
                  Verify expiry &amp; validity
                </div>
              </div>
              <button
                onClick={() => setConfig((c) => ({ ...c, checkSSL: !c.checkSSL }))}
                className={`relative w-[38px] h-[22px] rounded-full transition-colors ${
                  config.checkSSL ? "bg-[var(--primary)]" : "bg-[var(--border)]"
                }`}
              >
                <span
                  className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform ${
                    config.checkSSL ? "translate-x-[16px]" : ""
                  }`}
                />
              </button>
            </div>
            {config.checkSSL && (
              <div className="mt-[12px] flex gap-[6px]">
                {SSL_FREQ_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setConfig((c) => ({ ...c, sslFrequency: opt.value }))}
                    className={`h-[30px] px-[10px] text-[11.5px] font-semibold border transition-colors ${
                      config.sslFrequency === opt.value
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                        : "bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--accent)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Alert channels */}
          <Field label="Alert channels">
            <div className="flex flex-col gap-[8px]">
              {[
                { key: "alertEmail" as const, label: "Email", desc: "Send to account email" },
              ].map((ch) => (
                <div key={ch.key} className="flex items-center justify-between py-[6px]">
                  <div>
                    <div className="text-[13px] font-medium">{ch.label}</div>
                    <div className="text-[11.5px] text-[var(--muted-foreground)]">{ch.desc}</div>
                  </div>
                  <button
                    onClick={() => setConfig((c) => ({ ...c, [ch.key]: !c[ch.key] }))}
                    className={`relative w-[38px] h-[22px] rounded-full transition-colors ${
                      config[ch.key] ? "bg-[var(--primary)]" : "bg-[var(--border)]"
                    }`}
                  >
                    <span
                      className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform ${
                        config[ch.key] ? "translate-x-[16px]" : ""
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </Field>

          {/* Scope */}
          <Field label="Apply to">
            <div className="flex gap-[6px] mb-[10px]">
              {([
                { label: "All sites", value: "all" as const },
                { label: "Selected sites", value: "selected" as const },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setConfig((c) => ({ ...c, scope: opt.value }))}
                  className={`h-[32px] px-[14px] text-[12.5px] font-semibold border transition-colors ${
                    config.scope === opt.value
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                      : "bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--accent)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="border border-[var(--border)] max-h-[180px] overflow-y-auto divide-y divide-[var(--border)]">
              {sites.length === 0 ? (
                <div className="px-[12px] py-[10px] text-[12.5px] text-[var(--muted-foreground)]">Loading sites…</div>
              ) : (
                sites.map((site) => {
                  const checked = config.selectedSiteIds.includes(site.id);
                  return (
                    <label
                      key={site.id}
                      className={`flex items-center gap-[10px] px-[12px] py-[9px] text-[13px] cursor-pointer hover:bg-[var(--accent)] transition-colors ${
                        config.scope === "all" ? "opacity-40 pointer-events-none" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={config.scope === "all"}
                        onChange={() => toggleSite(site.id)}
                        className="accent-[var(--primary)]"
                      />
                      <span className="font-medium">{site.name}</span>
                      <span className="text-[var(--muted-foreground)] ml-auto">{site.domain}</span>
                    </label>
                  );
                })
              )}
            </div>
          </Field>
        </div>

        {/* -------- Footer -------- */}
        <div className="flex items-center justify-between px-[18px] h-[60px] border-t border-[var(--border)] flex-none">
          <button
            onClick={() => { setConfig({ ...DEFAULTS }); }}
            className="h-[36px] px-[14px] text-[12.5px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Reset defaults
          </button>
          <div className="flex items-center gap-[8px]">
            <button
              onClick={onClose}
              className="h-[36px] px-[14px] border border-[var(--border)] text-[12.5px] font-semibold hover:bg-[var(--accent)]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-[36px] px-[18px] bg-[var(--primary)] text-[var(--primary-foreground)] text-[12.5px] font-semibold disabled:opacity-50 hover:opacity-90"
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save configuration"}
            </button>
          </div>
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
/*  Tooltip icon                                                      */
/* ------------------------------------------------------------------ */
function TooltipHint({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center ml-[5px] align-middle">
      <span className="w-[15px] h-[15px] flex items-center justify-center text-[10px] font-bold border border-[var(--border)] text-[var(--muted-foreground)] cursor-help leading-none">
        ?
      </span>
      <div className="absolute left-[50%] -translate-x-1/2 bottom-[calc(100%+6px)] w-[240px] px-[11px] py-[8px] bg-[var(--foreground)] text-[var(--background)] text-[12px] font-normal leading-[1.45] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10 pointer-events-none normal-case tracking-normal">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-transparent border-t-[var(--foreground)]" />
      </div>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Field wrapper                                                     */
/* ------------------------------------------------------------------ */
function Field({ label, children, tooltip }: { label: string; children: React.ReactNode; tooltip?: string }) {
  return (
    <div>
      <div className="font-heading font-semibold text-[12.5px] tracking-[0.03em] uppercase text-[var(--muted-foreground)] mb-[8px] flex items-center">
        {label}
        {tooltip && <TooltipHint text={tooltip} />}
      </div>
      {children}
    </div>
  );
}
