"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { StatusDot } from "@/components/ui/StatusDot";
import { Badge } from "@/components/ui/Badge";
import { ConfigureChecksDrawer } from "@/components/monitoring/ConfigureChecksDrawer";
import { api } from "@/lib/api-client";

interface Incident {
  id: string;
  siteId: string;
  incidentType: string;
  severity: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  summary: string | null;
  site?: { name: string; domain: string } | null;
}

interface MonitoringOverview {
  totalSites: number;
  downSites: number;
  activeIncidents: number;
}

/* Map site names → stable IDs so clicking works with mock data */
const SITE_IDS: Record<string, string> = {
  "acme-corp.com": "1",
  "bluewave.io": "2",
  "shop.northstar.co": "3",
  "lotus-clinic.vn": "4",
  "nordic-travel.no": "5",
  "pixel-studio.co": "6",
};

export default function MonitoringPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<MonitoringOverview | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [mon, inc] = await Promise.all([
          api.get<MonitoringOverview>("/monitoring/overview").catch(() => null),
          api.get<{ data: Incident[] }>("/monitoring/incidents").catch(() => ({ data: [] })),
        ]);
        setOverview(mon || { totalSites: 0, downSites: 0, activeIncidents: 0 });
        setIncidents(inc.data || []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getIncidentDot = (status: string) => status === "OPEN" ? "danger" as const : "success" as const;

  const SITES = [
    { name: "acme-corp.com", domain: "acme-corp.com", uptime: "99.98%", status: "ok" },
    { name: "bluewave.io", domain: "bluewave.io", uptime: "99.91%", status: "ok" },
    { name: "shop.northstar.co", domain: "shop.northstar.co", uptime: "97.20%", status: "down" },
    { name: "lotus-clinic.vn", domain: "lotus-clinic.vn", uptime: "99.95%", status: "ok" },
    { name: "nordic-travel.no", domain: "nordic-travel.no", uptime: "99.88%", status: "ok" },
    { name: "pixel-studio.co", domain: "pixel-studio.co", uptime: "99.97%", status: "ok" },
  ];

  return (
    <>
      <Header
        title="Monitoring"
        subtitle="HTTP checks every 5 min · last run 1m ago"
      >
        <button
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-[7px] h-[36px] px-[14px] border border-[var(--border)] bg-[var(--background)] font-semibold text-[13px] cursor-pointer hover:bg-[var(--accent)]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg>
          Configure checks
        </button>
      </Header>

      <main className="wpcc-scroll flex-1 overflow-auto bg-[var(--muted)] p-[24px] flex flex-col gap-[16px]">
        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-[16px]">
          {[
            { label: "Avg uptime · 30d", value: "99.4%" },
            { label: "Avg response", value: "268", unit: " ms" },
            { label: "Checks today", value: "8,640" },
            { label: "Open incidents", value: overview?.activeIncidents || 0, danger: (overview?.activeIncidents || 0) > 0 },
          ].map((kpi, i) => (
            <div key={i} className="bg-[var(--card)] border border-[var(--border)] px-[18px] py-[16px]">
              <div className="text-[12px] font-medium text-[var(--muted-foreground)]">{kpi.label}</div>
              <div className="font-heading font-bold text-[26px] mt-[8px] flex items-center gap-[8px]">
                {kpi.value}{kpi.unit || ""}
                {i === 3 && (overview?.activeIncidents || 0) > 0 && <span className="w-[9px] h-[9px] rounded-full bg-[var(--danger)]" />}
              </div>
            </div>
          ))}
        </div>

        {/* Uptime per site — rows are clickable */}
        <div className="bg-[var(--card)] border border-[var(--border)]">
          <div className="flex items-center justify-between px-[18px] py-[14px] border-b border-[var(--border)]">
            <span className="font-heading font-semibold text-[15px]">Uptime · last 90 checks</span>
            <span className="text-[12px] text-[var(--muted-foreground)]">per site · click to drill down</span>
          </div>
          {loading ? (
            <div className="p-[18px] text-[13px] text-[var(--muted-foreground)]">Loading...</div>
          ) : (
            SITES.map((site) => (
              <div
                key={site.name}
                onClick={() => {
                  const sid = SITE_IDS[site.name];
                  if (sid) router.push(`/monitoring/${sid}`);
                }}
                className="flex items-center gap-[16px] px-[18px] py-[13px] border-b border-[var(--border)] last:border-0 cursor-pointer hover:bg-[var(--accent)] transition-colors"
              >
                <StatusDot tone={site.status === "down" ? "danger" : "success"} />
                <span className="text-[13px] font-semibold w-[188px] flex-none truncate">{site.name}</span>
                <div className="flex-1 flex gap-[2px] items-center">
                  {Array.from({ length: 40 }).map((_, i) => {
                    let color = "var(--success)";
                    if (site.status === "down" && i >= 37) color = "var(--danger)";
                    return <span key={i} className="flex-1 h-[20px]" style={{ background: color }} />;
                  })}
                </div>
                <span className="text-[13px] font-semibold w-[64px] text-right flex-none">{site.uptime}</span>
              </div>
            ))
          )}
        </div>

        {/* Incidents */}
        <div className="bg-[var(--card)] border border-[var(--border)]">
          <div className="px-[18px] py-[14px] border-b border-[var(--border)] font-heading font-semibold text-[15px]">
            Incident history
          </div>
          <div className="grid grid-cols-[1.4fr_1.2fr_1fr_110px] gap-[14px] px-[18px] py-[10px] border-b border-[var(--border)] font-heading text-[11px] font-semibold tracking-[0.04em] uppercase text-[var(--muted-foreground)]">
            <span>Site</span><span>Started</span><span>Duration</span><span className="text-right">Status</span>
          </div>
          {loading ? (
            <div className="p-[18px] text-[13px] text-[var(--muted-foreground)]">Loading...</div>
          ) : incidents.length === 0 ? (
            <div className="p-[18px] text-[13px] text-[var(--muted-foreground)]">No incidents recorded</div>
          ) : (
            incidents.map((inc) => (
              <div key={inc.id} className="grid grid-cols-[1.4fr_1.2fr_1fr_110px] gap-[14px] items-center px-[18px] py-[13px] border-b border-[var(--border)] text-[13px] hover:bg-[var(--accent)]">
                <span className="font-semibold flex items-center gap-[9px]">
                  <StatusDot tone={getIncidentDot(inc.status)} />
                  {inc.site?.name || inc.siteId}
                </span>
                <span className="text-[var(--muted-foreground)]">{new Date(inc.startedAt).toLocaleString()}</span>
                <span className="text-[var(--muted-foreground)]">
                  {inc.endedAt ? `${Math.round((new Date(inc.endedAt).getTime() - new Date(inc.startedAt).getTime()) / 60000)}m` : "Ongoing"}
                </span>
                <span className="justify-self-end">
                  <Badge tone={inc.status === "OPEN" ? "danger" : "success"}>{inc.status}</Badge>
                </span>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Configure checks drawer */}
      <ConfigureChecksDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
