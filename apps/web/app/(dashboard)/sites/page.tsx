"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { StatusDot } from "@/components/ui/StatusDot";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api-client";

interface Site {
  id: string;
  name: string;
  domain: string;
  siteUrl: string;
  environment: string;
  connectionStatus: string;
  wpVersion?: string;
  phpVersion?: string;
  [key: string]: unknown;
}

type ViewMode = "grid" | "list";

export default function SitesPage() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    siteId: string;
    action: string;
    body?: Record<string, unknown>;
    message: string;
    successMsg?: string;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-card-menu]")) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpenId]);

  const fetchSites = async () => {
    const token = localStorage.getItem("wpcc_token");
    if (!token) {
      router.push("/");
      return;
    }
    try {
      const body = await api.get<{ data: Site[] }>("/sites");
      setSites(body.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleMenuAction = async (siteId: string, action: string, body: Record<string, unknown> = {}, successMsg?: string) => {
    setMenuOpenId(null);
    try {
      if (action === "disable") {
        await api.patch(`/sites/${siteId}`, { status: "DISABLED" });
        setSites((prev) => prev.filter((s) => s.id !== siteId));
        showToast("Site disabled");
        return;
      }
      await api.post(`/sites/${siteId}/actions/${action}`, body);
      if (action === "clear-cache") showToast("Cache clear job queued!");
      else if (action === "optimize-database") showToast("DB optimization job queued!");
      else if (action === "toggle-maintenance") showToast("Maintenance mode toggled!");
      else if (successMsg) showToast(successMsg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Action ${action} failed`;
      showToast(msg, 'error');
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => fetchSites());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredSites = sites.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const needAttention = sites.filter((s) => s.connectionStatus !== "CONNECTED").length;

  const getDot = (status: string) => {
    switch (status) {
      case "CONNECTED": return "success" as const;
      case "PENDING": return "warning" as const;
      case "ERROR":
      case "DISCONNECTED": return "danger" as const;
      default: return "neutral" as const;
    }
  };

  const getEnvBadge = (env: string) => {
    switch (env) {
      case "PRODUCTION": return "danger" as const;
      case "STAGING": return "warning" as const;
      case "DEVELOPMENT": return "neutral" as const;
      default: return "neutral" as const;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONNECTED": return "success" as const;
      case "PENDING": return "warning" as const;
      case "ERROR":
      case "DISCONNECTED": return "danger" as const;
      default: return "neutral" as const;
    }
  };

  return (
    <>
      <Header
        title="Sites"
        subtitle={`${sites.length} connected · ${needAttention} need attention`}
      >
        {/* Search */}
        <div className="flex items-center gap-[8px] w-[220px] h-[36px] px-[11px] border border-[var(--input)] bg-[var(--background)] text-[var(--muted-foreground)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            type="text"
            placeholder="Search sites…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-[13px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
          />
        </div>

        {/* View toggle */}
        <div className="flex h-[36px] border border-[var(--border)] bg-[var(--background)]">
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-[6px] px-[11px] text-[12.5px] font-semibold border-r border-[var(--border)] ${
              viewMode === "grid"
                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "text-[var(--muted-foreground)] font-medium"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3"/><rect width="7" height="7" x="14" y="3"/><rect width="7" height="7" x="14" y="14"/><rect width="7" height="7" x="3" y="14"/></svg>
            Cards
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-[6px] px-[11px] text-[12.5px] font-semibold ${
              viewMode === "list"
                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "text-[var(--muted-foreground)] font-medium"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
            List
          </button>
        </div>
      </Header>

      <main className={`wpcc-scroll flex-1 overflow-auto bg-[var(--muted)] p-[24px] ${
        viewMode === "grid"
          ? "grid grid-cols-3 gap-[16px] auto-rows-min content-start"
          : "flex flex-col gap-[12px]"
      }`}>
        {loading ? (
          <div className="col-span-3 flex items-center justify-center h-[200px] text-[13px] text-[var(--muted-foreground)]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent mr-[12px]" />
            Loading sites...
          </div>
        ) : filteredSites.length === 0 ? (
          <div className="col-span-3 text-center py-[40px] text-[14px] text-[var(--muted-foreground)]">
            {searchQuery ? "No sites match your search" : "No sites found. Click 'Add site' to get started."}
          </div>
        ) : viewMode === "grid" ? (
          /* Card Grid View */
          filteredSites.map((site) => (
            <div key={site.id} className="bg-[var(--card)] border border-[var(--border)] p-[16px] flex flex-col gap-[12px] relative">
              <div className="flex items-start justify-between gap-[8px]">
                <div className="flex items-center gap-[9px] min-w-0">
                  <StatusDot tone={getDot(site.connectionStatus)} />
                  <Link href={`/sites/${site.id}`} className="font-semibold text-[14px] text-[var(--foreground)] truncate hover:text-[var(--primary)]">
                    {site.name}
                  </Link>
                </div>
                <div data-card-menu className="relative flex-none">
                  <button
                    onClick={() => setMenuOpenId(menuOpenId === site.id ? null : site.id)}
                    className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-[2px]"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                  </button>

                  {menuOpenId === site.id && (
                    <div className="absolute top-[28px] right-0 w-[190px] bg-[var(--popover)] border border-[var(--border)] shadow-lg z-10 p-[5px]">
                      <button
                        onClick={() => handleMenuAction(site.id, "update-plugin", { slug: "" }, "Update jobs queued!")}
                        className="flex items-center gap-[9px] w-full text-[12.5px] font-medium px-[9px] py-[8px] bg-[var(--accent)] hover:opacity-80 text-left"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/></svg>
                        Update all (3)
                      </button>
                      <button
                        onClick={() => handleMenuAction(site.id, "clear-cache")}
                        className="flex items-center gap-[9px] w-full text-[12.5px] px-[9px] py-[8px] text-[var(--foreground)] hover:bg-[var(--accent)] text-left"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
                        Clear cache
                      </button>
                      <button
                        onClick={() => {
                          setConfirmState({
                            open: true,
                            siteId: site.id,
                            action: "toggle-maintenance",
                            body: { enabled: true },
                            message: `Enable maintenance mode for ${site.name}? Visitors will see a holding page.`,
                          });
                        }}
                        className="flex items-center gap-[9px] w-full text-[12.5px] px-[9px] py-[8px] text-[var(--foreground)] hover:bg-[var(--accent)] text-left"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/></svg>
                        Maintenance mode
                      </button>
                      <button
                        onClick={() => handleMenuAction(site.id, "optimize-database")}
                        className="flex items-center gap-[9px] w-full text-[12.5px] px-[9px] py-[8px] text-[var(--foreground)] hover:bg-[var(--accent)] text-left"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>
                        Optimize DB
                      </button>
                      <div className="h-[1px] bg-[var(--border)] my-[4px]" />
                      <button
                        onClick={() => {
                          setConfirmState({
                            open: true,
                            siteId: site.id,
                            action: "disable",
                            message: `Permanently disable ${site.name}? This action cannot be undone.`,
                          });
                        }}
                        className="flex items-center gap-[9px] w-full text-[12.5px] px-[9px] py-[8px] text-[var(--danger)] hover:bg-[var(--accent)] text-left"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        Disable site
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-[7px]">
                <Badge tone={getEnvBadge(site.environment)}>{site.environment}</Badge>
                <Badge tone="neutral">client</Badge>
              </div>

              <div className="flex justify-between gap-[10px] py-[11px] border-t border-b border-[var(--border)]">
                <div>
                  <div className="font-heading font-bold text-[16px]">3</div>
                  <div className="text-[11px] text-[var(--muted-foreground)] mt-[1px]">updates</div>
                </div>
                <div>
                  <div className="font-heading font-bold text-[16px]">99.9%</div>
                  <div className="text-[11px] text-[var(--muted-foreground)] mt-[1px]">uptime</div>
                </div>
                <div>
                  <div className="font-heading font-bold text-[16px]">{site.wpVersion || "—"}</div>
                  <div className="text-[11px] text-[var(--muted-foreground)] mt-[1px]">WP</div>
                </div>
              </div>

              <div className="flex gap-[8px]">
                <Link
                  href={`/sites/${site.id}?tab=updates`}
                  className="flex-1 h-[32px] flex items-center justify-center bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-[12.5px] hover:opacity-90 transition-opacity"
                >
                  Update
                </Link>
                <Link
                  href={`/sites/${site.id}?tab=tools`}
                  className="flex-1 h-[32px] flex items-center justify-center border border-[var(--border)] text-[var(--foreground)] font-semibold text-[12.5px] hover:bg-[var(--accent)] transition-colors"
                >
                  Tools
                </Link>
              </div>
            </div>
          ))
        ) : (
          /* List View (table) */
          <div className="bg-[var(--card)] border border-[var(--border)] overflow-hidden">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--accent)] text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted-foreground)]">
                  <th className="p-[13px]">Site</th>
                  <th className="p-[13px]">Domain</th>
                  <th className="p-[13px]">Environment</th>
                  <th className="p-[13px]">Status</th>
                  <th className="p-[13px]">WP</th>
                  <th className="p-[13px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredSites.map((site) => (
                  <tr key={site.id} className="hover:bg-[var(--accent)] transition-colors">
                    <td className="p-[13px] font-semibold flex items-center gap-[9px]">
                      <StatusDot tone={getDot(site.connectionStatus)} />
                      <Link href={`/sites/${site.id}`} className="hover:text-[var(--primary)]">{site.name}</Link>
                    </td>
                    <td className="p-[13px] text-[var(--muted-foreground)]">{site.domain}</td>
                    <td className="p-[13px]"><Badge tone={getEnvBadge(site.environment)}>{site.environment}</Badge></td>
                    <td className="p-[13px]"><Badge tone={getStatusBadge(site.connectionStatus)}>{site.connectionStatus}</Badge></td>
                    <td className="p-[13px] text-[var(--muted-foreground)]">{site.wpVersion || "—"}</td>
                    <td className="p-[13px] text-right">
                      <Link href={`/sites/${site.id}`} className="inline-flex items-center h-[30px] px-[14px] border border-[var(--border)] font-semibold text-[12px] hover:bg-[var(--accent)] transition-colors">Manage</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Confirmation modal */}
      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--card)] border border-[var(--border)] p-[24px] w-[360px] shadow-xl">
            <p className="text-[13px] mb-[16px]">{confirmState.message}</p>
            <div className="flex gap-[8px] justify-end">
              <button
                onClick={() => setConfirmState(null)}
                className="h-[34px] px-[14px] border border-[var(--border)] bg-[var(--background)] text-[12.5px] font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const { siteId, action, body, successMsg } = confirmState;
                  setConfirmState(null);
                  await handleMenuAction(siteId, action, body || {}, successMsg);
                }}
                className="h-[34px] px-[14px] bg-[var(--primary)] text-[var(--primary-foreground)] text-[12.5px] font-semibold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-[24px] right-[24px] z-50 bg-[var(--card)] border border-[var(--border)] px-[16px] py-[12px] shadow-lg animate-slideIn">
          <span className="text-[12.5px]" style={{ color: toast.type === 'error' ? 'var(--danger)' : 'var(--success)' }}>
            {toast.message}
          </span>
        </div>
      )}
    </>
  );
}
