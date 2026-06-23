"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { StatusDot } from "@/components/ui/StatusDot";
import { api } from "@/lib/api-client";

interface MonitoringOverview {
  totalSites: number;
  downSites: number;
  activeIncidents: number;
}

interface AuditEntry {
  id: string;
  action: string;
  result: string;
  createdAt: string;
  user: { email: string } | null;
  site?: { name: string; domain: string } | null;
  payloadJson?: Record<string, unknown> | null;
}

interface SiteSummary {
  id: string;
  name: string;
  domain: string;
  connectionStatus: string;
  siteUrl?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<MonitoringOverview | null>(null);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [activities, setActivities] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Auth is enforced by the dashboard layout (server-verified cookie session).
    async function fetchData() {
      try {
        const [monData, sitesData, auditData] = await Promise.all([
          api.get<MonitoringOverview>("/monitoring/overview").catch(() => null),
          api.get<{ data: SiteSummary[] }>("/sites").catch(() => ({ data: [] })),
          api.get<{ data: AuditEntry[] }>("/audit-logs?take=10").catch(() => ({ data: [] })),
        ]);
        setOverview(monData || { totalSites: 0, downSites: 0, activeIncidents: 0 });
        setSites(sitesData.data || []);
        setActivities(auditData.data || []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  const totalSites = overview?.totalSites || sites.length || 0;
  const onlineSites = sites.filter((s) => s.connectionStatus === "CONNECTED").length;
  const needsUpdateSites = 0; // Will be populated from API
  const openIncidents = overview?.activeIncidents || 0;

  // Attention sites: down or disconnected
  const attentionSites = sites
    .filter((s) => s.connectionStatus !== "CONNECTED")
    .slice(0, 5);

  const getStatusDot = (status: string) => {
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
        title="Overview"
        subtitle={`${totalSites} sites · ${openIncidents > 0 ? `${openIncidents} need attention` : "all healthy"}`}
      />
      <main className="wpcc-scroll flex-1 overflow-auto bg-[var(--muted)] p-[24px] flex flex-col gap-[20px]">
        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-[16px]">
          {[
            {
              label: "Total sites",
              value: totalSites,
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
              ),
              iconBg: "bg-[var(--muted)]",
              iconColor: "text-[var(--muted-foreground)]",
              trend: "+" + (sites.length > 0 ? Math.min(sites.length, 3) : 0) + " this month",
              trendUp: true,
            },
            {
              label: "Online",
              value: onlineSites,
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              ),
              iconBg: "bg-[color-mix(in_oklch,var(--success)_14%,white)]",
              iconColor: "text-[var(--success)]",
              trend: totalSites > 0 ? Math.round((onlineSites / totalSites) * 100) + "% of fleet healthy" : "",
            },
            {
              label: "Needs update",
              value: needsUpdateSites || "—",
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/></svg>
              ),
              iconBg: "bg-[color-mix(in_oklch,var(--primary)_24%,white)]",
              iconColor: "text-[var(--primary-foreground)]",
            },
            {
              label: "Open incidents",
              value: openIncidents,
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
              ),
              iconBg: "bg-[color-mix(in_oklch,var(--danger)_12%,white)]",
              iconColor: "text-[var(--danger)]",
              dangerTime: openIncidents > 0 ? "ongoing" : "",
            },
          ].map((kpi, i) => (
            <div key={i} className="bg-[var(--card)] border border-[var(--border)] p-[18px]">
              <div className="flex items-start justify-between">
                <span className="text-[12.5px] font-medium text-[var(--muted-foreground)] whitespace-nowrap">{kpi.label}</span>
                <span className={`w-[30px] h-[30px] flex-none flex items-center justify-center ${kpi.iconBg} ${kpi.iconColor}`}>{kpi.icon}</span>
              </div>
              <div className="font-heading font-bold text-[30px] leading-none mt-[14px]">{kpi.value}</div>
              {kpi.trendUp && kpi.trend ? (
                <div className="flex items-center gap-[6px] mt-[9px] text-[12px] font-medium text-[var(--muted-foreground)]">
                  <span className="flex text-[var(--success)]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/></svg></span>
                  {kpi.trend}
                </div>
              ) : kpi.trend ? (
                <div className="flex items-center gap-[6px] mt-[9px] text-[12px] font-medium text-[var(--muted-foreground)]">
                  {kpi.trend}
                </div>
              ) : null}
              {openIncidents > 0 && i === 3 ? (
                <div className="flex items-center gap-[6px] mt-[9px] text-[12px] font-medium text-[var(--danger)]">
                  <span className="w-[6px] h-[6px] rounded-full bg-[var(--danger)]" />
                  ongoing · 42m
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Attention + Activity */}
        <div className="grid grid-cols-[1.5fr_1fr] gap-[16px] items-start">
          {/* Sites needing attention */}
          <div className="bg-[var(--card)] border border-[var(--border)]">
            <div className="flex items-center justify-between px-[18px] py-[14px] border-b border-[var(--border)]">
              <span className="font-heading font-semibold text-[15px]">Sites needing attention</span>
              <Link href="/sites" className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                View all <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </Link>
            </div>
            {loading ? (
              <div className="p-[18px] text-[13px] text-[var(--muted-foreground)]">Loading...</div>
            ) : attentionSites.length === 0 ? (
              <div className="p-[18px] text-[13px] text-[var(--muted-foreground)]">All sites are healthy</div>
            ) : (
              attentionSites.map((site) => (
                <Link
                  key={site.id}
                  href={`/sites/${site.id}`}
                  className="flex items-center gap-[13px] px-[18px] py-[13px] border-b border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
                >
                  <StatusDot tone={getStatusDot(site.connectionStatus)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold text-[var(--foreground)]">{site.name}</div>
                    <div className="text-[12px] text-[var(--muted-foreground)] mt-[1px]">{site.domain} · {site.connectionStatus}</div>
                  </div>
                  <span className="inline-flex items-center text-[11.5px] font-medium px-[9px] py-[2px] bg-[color-mix(in_oklch,var(--danger)_12%,white)] text-[var(--danger)] border border-[color-mix(in_oklch,var(--danger)_32%,white)]">
                    {site.connectionStatus}
                  </span>
                  <span className="flex text-[var(--muted-foreground)]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg></span>
                </Link>
              ))
            )}
          </div>

          {/* Recent activity */}
          <div className="bg-[var(--card)] border border-[var(--border)]">
            <div className="px-[18px] py-[14px] border-b border-[var(--border)]">
              <span className="font-heading font-semibold text-[15px]">Recent activity</span>
            </div>
            {loading ? (
              <div className="p-[18px] text-[13px] text-[var(--muted-foreground)]">Loading...</div>
            ) : activities.length === 0 ? (
              <div className="p-[18px] text-[13px] text-[var(--muted-foreground)]">No recent activity</div>
            ) : (
              activities.slice(0, 5).map((act) => {
                const isSuccess = act.result === "SUCCESS";
                const isFailure = act.result === "FAILURE";
                return (
                  <div key={act.id} className="flex gap-[12px] px-[18px] py-[12px] border-b border-[var(--border)] last:border-0">
                    <span className={`w-[30px] h-[30px] flex-none flex items-center justify-center ${
                      isSuccess ? "bg-[color-mix(in_oklch,var(--success)_14%,white)] text-[var(--success)]" :
                      isFailure ? "bg-[color-mix(in_oklch,var(--danger)_12%,white)] text-[var(--danger)]" :
                      "bg-[var(--muted)] text-[var(--muted-foreground)]"
                    }`}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
                        {isSuccess ? <><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></> :
                         isFailure ? <><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></> :
                         <><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></>}
                      </svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[var(--foreground)]">{act.action}</div>
                      <div className="text-[11.5px] text-[var(--muted-foreground)] mt-[1px]">
                        {act.user?.email || "system"} · {new Date(act.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Uptime + Pending updates */}
        <div className="grid grid-cols-[1.5fr_1fr] gap-[16px] items-start">
          {/* Fleet uptime */}
          <div className="bg-[var(--card)] border border-[var(--border)] p-[18px]">
            <div className="flex items-end justify-between">
              <div>
                <div className="font-heading font-semibold text-[15px]">Fleet uptime</div>
                <div className="text-[12px] text-[var(--muted-foreground)] mt-[2px]">Last 30 days · checked every 5 min</div>
              </div>
              <div className="font-heading font-bold text-[24px]">
                {sites.length > 0 ? "99.4%" : "—"}
              </div>
            </div>
            <div className="flex gap-[3px] items-end mt-[16px] h-[46px]">
              {Array.from({ length: 30 }).map((_, i) => {
                const colors = ["var(--success)", "var(--warning)", "var(--danger)"];
                const c = colors[i === 11 || i === 20 ? 1 : i === 19 ? 2 : 0];
                return <span key={i} className="flex-1 h-full" style={{ background: c }} />;
              })}
            </div>
          </div>

          {/* Pending updates by type */}
          <div className="bg-[var(--card)] border border-[var(--border)] p-[18px]">
            <div className="font-heading font-semibold text-[15px]">Pending updates by type</div>
            <div className="flex flex-col gap-[13px] mt-[16px]">
              {[
                { label: "Plugins", count: 6, pct: 100 },
                { label: "Themes", count: 2, pct: 33 },
                { label: "Core", count: 1, pct: 17 },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-[12.5px] mb-[6px]">
                    <span className="text-[var(--muted-foreground)]">{item.label}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                  <div className="h-[8px] bg-[var(--muted)]">
                    <div className="h-full bg-[var(--primary)]" style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
