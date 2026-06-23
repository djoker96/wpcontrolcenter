"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/StatusDot";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { api } from "@/lib/api-client";
import { UploadUpdateDrawer } from "@/components/updates/UploadUpdateDrawer";

interface SiteData {
  id: string;
  name: string;
  domain: string;
  siteUrl: string;
  environment: string;
  connectionStatus: string;
  wpVersion?: string;
  phpVersion?: string;
  lastSeenAt?: string;
  maintenanceMode?: boolean;
  objectCacheEnabled?: boolean;
  objectCacheType?: string;
  [key: string]: unknown;
}

type TabId = "overview" | "updates" | "plugins" | "themes" | "tools" | "monitoring" | "traffic";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "updates", label: "Updates" },
  { id: "plugins", label: "Plugins" },
  { id: "themes", label: "Themes" },
  { id: "tools", label: "Tools" },
  { id: "monitoring", label: "Monitoring" },
  { id: "traffic", label: "Traffic" },
];

/* ------------------------------------------------------------------ */
/*  Monitoring summary sub-component                                  */
/* ------------------------------------------------------------------ */
function SiteMonitoringSummary({ siteId }: { siteId: string; siteName: string }) {
  const router = useRouter();

  /* Mock a few stats */
  const uptime = "99.91%";
  const avgResponse = "245 ms";
  const lastCheck = "2m ago";
  const checks = [
    { time: "2m ago", code: 200, ms: 182, ok: true },
    { time: "7m ago", code: 200, ms: 203, ok: true },
    { time: "12m ago", code: 200, ms: 191, ok: true },
    { time: "17m ago", code: 200, ms: 430, ok: true },
    { time: "22m ago", code: 502, ms: 0, ok: false },
    { time: "27m ago", code: 200, ms: 167, ok: true },
  ];

  return (
    <div className="flex flex-col gap-[16px]">
      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-[14px]">
        {[
          { label: "Uptime (30d)", value: uptime },
          { label: "Avg response", value: avgResponse },
          { label: "Last check", value: lastCheck },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--card)] border border-[var(--border)] px-[16px] py-[12px]">
            <div className="text-[11.5px] font-medium text-[var(--muted-foreground)]">{s.label}</div>
            <div className="font-heading font-bold text-[20px] mt-[4px]">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Recent checks mini table */}
      <div className="bg-[var(--card)] border border-[var(--border)]">
        <div className="px-[16px] py-[11px] border-b border-[var(--border)] font-heading font-semibold text-[14px]">
          Recent checks
        </div>
        <div className="grid grid-cols-[1fr_80px_100px] gap-[12px] px-[16px] py-[8px] border-b border-[var(--border)] font-heading text-[10.5px] font-semibold tracking-[0.04em] uppercase text-[var(--muted-foreground)]">
          <span>Time</span><span>Code</span><span className="text-right">Response</span>
        </div>
        {checks.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_100px] gap-[12px] items-center px-[16px] py-[9px] border-b border-[var(--border)] text-[12.5px] hover:bg-[var(--accent)]">
            <span className="flex items-center gap-[6px]">
              <span className={`w-[6px] h-[6px] rounded-full ${c.ok ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`} />
              {c.time}
            </span>
            <span className="font-mono">{c.code}</span>
            <span className="font-mono text-right">{c.ok ? `${c.ms} ms` : "—"}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => router.push(`/monitoring/${siteId}`)}
        className="self-start inline-flex items-center gap-[7px] h-[36px] px-[16px] bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-[13px] hover:opacity-90"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        View full monitoring
      </button>
    </div>
  );
}

export default function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [site, setSite] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [objectCacheEnabled, setObjectCacheEnabled] = useState(false);
  const [objectCacheType, setObjectCacheType] = useState('Checking…');
  const [togglingObjectCache, setTogglingObjectCache] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [lastCacheCleared, setLastCacheCleared] = useState<string | null>(null);
  const [optimizingDb, setOptimizingDb] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [uploadDrawerState, setUploadDrawerState] = useState<{
    open: boolean;
    presetType?: "plugin" | "theme";
    presetSlug?: string;
  }>({ open: false });

  useEffect(() => {
    async function fetchSite() {
      try {
        const data = await api.get<SiteData>(`/sites/${id}`);
        setSite(data);
        // Initialize tool states from site data
        if (typeof data.maintenanceMode === 'boolean') {
          setMaintenanceMode(data.maintenanceMode);
        }
        if (typeof data.objectCacheEnabled === 'boolean') {
          setObjectCacheEnabled(data.objectCacheEnabled);
          setObjectCacheType((data.objectCacheType as string) || 'Redis');
        }
      } catch (err: unknown) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchSite();
  }, [id, router]);

  /* ── Toast helper ── */
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ── Tool action handlers ── */
  const handleToggleMaintenance = useCallback(async (enabled: boolean) => {
    setTogglingMaintenance(true);
    setMaintenanceMode(enabled); // optimistic
    try {
      await api.post(`/sites/${id}/actions/toggle-maintenance`, { enabled });
      showToast(enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled');
    } catch {
      setMaintenanceMode(!enabled); // revert
      showToast('Failed to toggle maintenance mode', 'error');
    } finally {
      setTogglingMaintenance(false);
    }
  }, [id, showToast]);

  const handleToggleObjectCache = useCallback(async (enabled: boolean) => {
    setTogglingObjectCache(true);
    setObjectCacheEnabled(enabled); // optimistic
    try {
      await api.post(`/sites/${id}/actions/object-cache-${enabled ? 'enable' : 'disable'}`, { enabled });
      showToast(enabled ? 'Object cache enabled' : 'Object cache disabled');
    } catch {
      setObjectCacheEnabled(!enabled); // revert
      showToast('Failed to toggle object cache', 'error');
    } finally {
      setTogglingObjectCache(false);
    }
  }, [id, showToast]);

  const handleClearCache = useCallback(async () => {
    setClearingCache(true);
    try {
      await api.post(`/sites/${id}/actions/clear-cache`, {});
      setLastCacheCleared('just now');
      showToast('Cache cleared successfully');
    } catch {
      showToast('Failed to clear cache', 'error');
    } finally {
      setClearingCache(false);
    }
  }, [id, showToast]);

  const handleOptimizeDb = useCallback(async () => {
    setOptimizingDb(true);
    try {
      await api.post(`/sites/${id}/actions/optimize-database`, {});
      showToast('Database optimized successfully');
    } catch {
      showToast('Failed to optimize database', 'error');
    } finally {
      setOptimizingDb(false);
    }
  }, [id, showToast]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--muted)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--muted)] text-[14px] text-[var(--muted-foreground)]">
        Site not found
      </div>
    );
  }

  const getDot = () => {
    switch (site.connectionStatus) {
      case "CONNECTED": return "success" as const;
      case "PENDING": return "warning" as const;
      default: return "danger" as const;
    }
  };

  const envBadge = (env: string) => {
    switch (env) {
      case "PRODUCTION": return "danger" as const;
      case "STAGING": return "warning" as const;
      default: return "neutral" as const;
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Breadcrumb + Header */}
      <header className="flex-none border-b border-[var(--border)] bg-[var(--background)]">
        <div className="px-[24px] pt-[18px]">
          <div className="flex items-center gap-[6px] text-[12px] text-[var(--muted-foreground)]">
            <Link href="/sites" className="hover:text-[var(--foreground)]">Sites</Link>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            <span className="text-[var(--foreground)] font-medium">{site.name}</span>
          </div>
          <div className="flex items-center gap-[11px] mt-[10px]">
            <StatusDot tone={getDot()} />
            <span className="font-heading font-bold text-[24px] tracking-tight">{site.name}</span>
            <Badge tone={envBadge(site.environment)}>{site.environment}</Badge>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-[22px] px-[24px] mt-[18px] overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-[12px] text-[13.5px] whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "text-[var(--foreground)] font-semibold border-b-2 border-[var(--primary)]"
                  : "text-[var(--muted-foreground)] font-medium hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="wpcc-scroll flex-1 overflow-auto bg-[var(--muted)] p-[24px]">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="grid gap-[16px] md:grid-cols-2">
            <div className="bg-[var(--card)] border border-[var(--border)] p-[20px]">
              <h3 className="font-heading font-semibold text-[15px] mb-[16px]">Site Info</h3>
              <div className="flex flex-col gap-[10px] text-[13px]">
                {[
                  { label: "URL", value: site.siteUrl },
                  { label: "Domain", value: site.domain },
                  { label: "Status", value: site.connectionStatus },
                  { label: "WordPress", value: site.wpVersion || "Unknown" },
                  { label: "PHP", value: site.phpVersion || "Unknown" },
                  { label: "Last seen", value: site.lastSeenAt ? new Date(site.lastSeenAt).toLocaleString() : "Never" },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between py-[6px] border-b border-[var(--border)] last:border-0">
                    <span className="text-[var(--muted-foreground)]">{item.label}</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] p-[20px]">
              <h3 className="font-heading font-semibold text-[15px] mb-[16px]">Quick Actions</h3>
              <div className="flex flex-col gap-[8px]">
                <Button variant="outline" className="w-full justify-start">Sync Now</Button>
                <Button variant="outline" className="w-full justify-start">Generate Connection Token</Button>
                <Button variant="destructive" className="w-full justify-start">Disconnect Site</Button>
              </div>
            </div>
          </div>
        )}

        {/* Updates Tab — per-category update cards */}
        {activeTab === "updates" && (
          <div className="flex flex-col gap-[16px]">
            {/* Upload zip button */}
            <div className="flex justify-end">
              <button
                onClick={() => setUploadDrawerState({ open: true })}
                className="inline-flex items-center gap-[6px] h-[34px] px-[14px] border border-[var(--border)] bg-[var(--card)] font-semibold text-[12.5px] hover:bg-[var(--accent)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
                </svg>
                Upload zip
              </button>
            </div>
            {/* ── Core Update ── */}
            <div className="bg-[var(--card)] border border-[var(--border)]">
              <div className="flex items-center justify-between px-[20px] py-[14px] border-b border-[var(--border)]">
                <div className="flex items-center gap-[10px]">
                  <div className="w-[9px] h-[9px] rounded-full bg-[var(--danger)]" />
                  <h3 className="font-heading font-semibold text-[15px]">WordPress Core</h3>
                </div>
                <span className="text-[11.5px] font-medium text-[var(--muted-foreground)]">Update available</span>
              </div>
              <div className="p-[18px] flex items-center justify-between">
                <div className="flex items-center gap-[22px]">
                  <div>
                    <div className="text-[11.5px] font-medium text-[var(--muted-foreground)]">Current version</div>
                    <div className="font-heading font-bold text-[18px] mt-[2px]">6.7.2</div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-foreground)]"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  <div>
                    <div className="text-[11.5px] font-medium text-[var(--muted-foreground)]">Latest version</div>
                    <div className="font-heading font-bold text-[18px] mt-[2px] text-[var(--primary)]">6.8.0</div>
                  </div>
                </div>
                <button className="inline-flex items-center gap-[6px] h-[34px] px-[16px] bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-[12.5px] hover:opacity-90">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                  Update now
                </button>
              </div>
            </div>

            {/* ── Theme Updates ── */}
            <div className="bg-[var(--card)] border border-[var(--border)]">
              <div className="flex items-center justify-between px-[20px] py-[14px] border-b border-[var(--border)]">
                <div className="flex items-center gap-[10px]">
                  <div className="w-[9px] h-[9px] rounded-full bg-[var(--warning)]" />
                  <h3 className="font-heading font-semibold text-[15px]">Themes</h3>
                </div>
                <span className="text-[11.5px] font-medium text-[var(--muted-foreground)]">2 updates pending</span>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {[
                  { name: "Twenty Twenty-Five", slug: "twenty-twenty-five", current: "1.1", latest: "1.2", severity: "security" as const },
                  { name: "Astra", slug: "astra", current: "4.8.3", latest: "4.9.0", severity: "feature" as const },
                ].map((t) => (
                  <div key={t.name} className="flex items-center justify-between px-[20px] py-[13px] hover:bg-[var(--accent)]">
                    <div className="flex items-center gap-[10px] min-w-0">
                      <div className="w-[34px] h-[34px] rounded border border-[var(--border)] bg-[var(--muted)] flex items-center justify-center flex-none">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold truncate">{t.name}</div>
                        <div className="text-[11.5px] text-[var(--muted-foreground)]">
                          {t.current} → <span className="text-[var(--primary)] font-medium">{t.latest}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-[6px] flex-none">
                      <span className={`text-[10.5px] font-semibold tracking-[0.04em] uppercase px-[8px] py-[3px] ${
                        t.severity === "security"
                          ? "bg-[var(--danger)]/10 text-[var(--danger)]"
                          : "bg-[var(--info)]/10 text-[var(--info)]"
                      }`}>
                        {t.severity}
                      </span>
                      <button className="text-[12px] font-semibold text-[var(--primary)] hover:underline">Update</button>
                      <button
                        onClick={() => setUploadDrawerState({ open: true, presetType: "theme", presetSlug: t.slug })}
                        title="Upload .zip manually"
                        className="inline-flex items-center justify-center w-[28px] h-[28px] border border-[var(--border)] hover:bg-[var(--accent)]"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Plugin Updates ── */}
            <div className="bg-[var(--card)] border border-[var(--border)]">
              <div className="flex items-center justify-between px-[20px] py-[14px] border-b border-[var(--border)]">
                <div className="flex items-center gap-[10px]">
                  <div className="w-[9px] h-[9px] rounded-full bg-[var(--danger)]" />
                  <h3 className="font-heading font-semibold text-[15px]">Plugins</h3>
                </div>
                <span className="text-[11.5px] font-medium text-[var(--muted-foreground)]">5 updates pending</span>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {[
                  { name: "Yoast SEO", slug: "wordpress-seo", current: "23.8", latest: "24.0", severity: "feature" as const },
                  { name: "WooCommerce", slug: "woocommerce", current: "9.6.2", latest: "9.7.0", severity: "security" as const },
                  { name: "Wordfence Security", slug: "wordfence", current: "8.0.2", latest: "8.1.0", severity: "security" as const },
                  { name: "Contact Form 7", slug: "contact-form-7", current: "6.0.1", latest: "6.1.0", severity: "feature" as const },
                  { name: "WP Rocket", slug: "wp-rocket", current: "3.18.3", latest: "3.19.0", severity: "feature" as const },
                ].map((p) => (
                  <div key={p.name} className="flex items-center justify-between px-[20px] py-[13px] hover:bg-[var(--accent)]">
                    <div className="flex items-center gap-[10px] min-w-0">
                      <div className="w-[34px] h-[34px] rounded border border-[var(--border)] bg-[var(--muted)] flex items-center justify-center flex-none">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold truncate">{p.name}</div>
                        <div className="text-[11.5px] text-[var(--muted-foreground)]">
                          {p.current} → <span className="text-[var(--primary)] font-medium">{p.latest}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-[6px] flex-none">
                      <span className={`text-[10.5px] font-semibold tracking-[0.04em] uppercase px-[8px] py-[3px] ${
                        p.severity === "security"
                          ? "bg-[var(--danger)]/10 text-[var(--danger)]"
                          : "bg-[var(--info)]/10 text-[var(--info)]"
                      }`}>
                        {p.severity}
                      </span>
                      <button className="text-[12px] font-semibold text-[var(--primary)] hover:underline">Update</button>
                      <button
                        onClick={() => setUploadDrawerState({ open: true, presetType: "plugin", presetSlug: p.slug })}
                        title="Upload .zip manually"
                        className="inline-flex items-center justify-center w-[28px] h-[28px] border border-[var(--border)] hover:bg-[var(--accent)]"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Plugins Tab */}
        {activeTab === "plugins" && (
          <div className="bg-[var(--card)] border border-[var(--border)] p-[20px]">
            <h3 className="font-heading font-semibold text-[15px] mb-[16px]">Installed Plugins</h3>
            <p className="text-[13px] text-[var(--muted-foreground)]">Plugin inventory will sync once the agent is connected.</p>
          </div>
        )}

        {/* Themes Tab */}
        {activeTab === "themes" && (
          <div className="bg-[var(--card)] border border-[var(--border)] p-[20px]">
            <h3 className="font-heading font-semibold text-[15px] mb-[16px]">Installed Themes</h3>
            <p className="text-[13px] text-[var(--muted-foreground)]">Theme inventory will sync once the agent is connected.</p>
          </div>
        )}

        {/* Tools Tab (hi-fi Remote Tools design) */}
        {activeTab === "tools" && (
          <div className="flex gap-[16px] items-start">
            {/* Operations Panel */}
            <div className="w-[380px] flex-none bg-[var(--card)] border border-[var(--border)]">
              <div className="px-[18px] py-[14px] border-b border-[var(--border)] font-heading font-semibold text-[15px]">Operations</div>
              <div className="p-[18px] flex flex-col gap-[13px]">
                <div className="flex items-center justify-between gap-[12px] border border-[var(--border)] p-[13px]">
                  <div>
                    <div className="text-[13px] font-semibold">Maintenance mode</div>
                    <div className="text-[11.5px] text-[var(--muted-foreground)] mt-[1px]">Show holding page to visitors</div>
                  </div>
                  <Switch checked={maintenanceMode} disabled={togglingMaintenance} onChange={handleToggleMaintenance} />
                </div>
                <div className="flex items-center justify-between gap-[12px] border border-[var(--border)] p-[13px]">
                  <div>
                    <div className="text-[13px] font-semibold">Object cache</div>
                    <div className="text-[11.5px] text-[var(--muted-foreground)] mt-[1px]">
                      {objectCacheType} · {objectCacheEnabled ? 'active' : 'inactive'}
                    </div>
                  </div>
                  <Switch checked={objectCacheEnabled} disabled={togglingObjectCache} onChange={handleToggleObjectCache} />
                </div>
                <div className="flex items-center justify-between gap-[12px] border border-[var(--border)] p-[13px]">
                  <div>
                    <div className="text-[13px] font-semibold">Clear all cache</div>
                    <div className="text-[11.5px] text-[var(--muted-foreground)] mt-[1px]">
                      {lastCacheCleared ? `Last cleared ${lastCacheCleared}` : 'Last cleared 2h ago'}
                    </div>
                  </div>
                  <span
                    onClick={handleClearCache}
                    className="inline-flex items-center justify-center h-[30px] px-[13px] border border-[var(--border)] font-semibold text-[12px] cursor-pointer hover:bg-[var(--accent)]"
                    style={clearingCache ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
                  >
                    {clearingCache ? 'Clearing…' : 'Run'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-[12px] border border-[var(--border)] p-[13px]">
                  <div>
                    <div className="text-[13px] font-semibold">Optimize database</div>
                    <div className="text-[11.5px] text-[var(--muted-foreground)] mt-[1px]">Clean revisions &amp; transients</div>
                  </div>
                  <span
                    onClick={handleOptimizeDb}
                    className="inline-flex items-center justify-center h-[30px] px-[13px] border border-[var(--border)] font-semibold text-[12px] cursor-pointer hover:bg-[var(--accent)]"
                    style={optimizingDb ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
                  >
                    {optimizingDb ? 'Optimizing…' : 'Run'}
                  </span>
                </div>
              </div>
            </div>

            {/* File Editor */}
            <div className="flex-1 min-w-0 bg-[var(--card)] border border-[var(--border)] flex flex-col">
              <div className="flex items-center gap-[6px] px-[14px] py-[12px] border-b border-[var(--border)]">
                <span className="font-mono text-[12.5px] font-semibold bg-[var(--accent)] px-[11px] py-[6px]">robots.txt</span>
                <span className="font-mono text-[12.5px] font-medium text-[var(--muted-foreground)] px-[11px] py-[6px]">.htaccess</span>
                <span className="font-mono text-[12.5px] font-medium text-[var(--muted-foreground)] px-[11px] py-[6px]">php.ini</span>
              </div>
              <div className="font-mono text-[12.5px] leading-[1.9] p-[18px] bg-[var(--background)] min-h-[300px]">
                <div><span className="text-[var(--muted-foreground)]">1</span>&nbsp;&nbsp;User-agent: *</div>
                <div><span className="text-[var(--muted-foreground)]">2</span>&nbsp;&nbsp;Disallow: /wp-admin/</div>
                <div><span className="text-[var(--muted-foreground)]">3</span>&nbsp;&nbsp;Allow: /wp-admin/admin-ajax.php</div>
                <div><span className="text-[var(--muted-foreground)]">4</span>&nbsp;&nbsp;Disallow: /?s=</div>
                <div><span className="text-[var(--muted-foreground)]">5</span>&nbsp;&nbsp;Disallow: /search/</div>
                <div><span className="text-[var(--muted-foreground)]">6</span>&nbsp;&nbsp;</div>
                <div><span className="text-[var(--muted-foreground)]">7</span>&nbsp;&nbsp;Sitemap: https://{site.domain}/sitemap.xml</div>
              </div>
              <div className="flex items-center justify-between px-[18px] py-[13px] border-t border-[var(--border)]">
                <span className="flex items-center gap-[7px] text-[12px] text-[var(--muted-foreground)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  Backed up before save · applied via agent
                </span>
                <div className="flex gap-[9px]">
                  <span className="inline-flex items-center h-[34px] px-[14px] border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] font-semibold text-[12.5px] cursor-pointer hover:bg-[var(--accent)]">Revert</span>
                  <span className="inline-flex items-center gap-[7px] h-[34px] px-[16px] bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-[12.5px] cursor-pointer hover:opacity-90">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>
                    Save changes
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Monitoring Tab */}
        {activeTab === "monitoring" && (
          <SiteMonitoringSummary siteId={id} siteName={site.name} />
        )}

        {/* Traffic Tab */}
        {activeTab === "traffic" && (
          <div className="bg-[var(--card)] border border-[var(--border)] p-[20px]">
            <h3 className="font-heading font-semibold text-[15px] mb-[16px]">Analytics & Search Console</h3>
            <p className="text-[13px] text-[var(--muted-foreground)]">Analytics data will appear once Google is connected.</p>
          </div>
        )}
      </main>

      {/* Upload drawer */}
      <UploadUpdateDrawer
        open={uploadDrawerState.open}
        onClose={() => setUploadDrawerState({ open: false })}
        siteId={id}
        siteName={site.name}
        presetType={uploadDrawerState.presetType}
        presetSlug={uploadDrawerState.presetSlug}
      />

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-[24px] right-[24px] z-50 bg-[var(--card)] border border-[var(--border)] px-[16px] py-[12px] shadow-lg animate-slideIn">
          <span className="text-[12.5px]" style={{ color: toast.type === 'error' ? 'var(--danger)' : 'var(--success)' }}>
            {toast.message}
          </span>
        </div>
      )}
    </div>
  );
}
