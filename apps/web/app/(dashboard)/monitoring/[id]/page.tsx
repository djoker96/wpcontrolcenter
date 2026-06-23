"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { StatusDot } from "@/components/ui/StatusDot";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api-client";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface SiteInfo {
  id: string;
  name: string;
  domain: string;
  siteUrl: string;
  connectionStatus: string;
  environment: string;
  wpVersion?: string;
  phpVersion?: string;
}

interface CheckRecord {
  id: string;
  timestamp: string;
  statusCode: number;
  responseTimeMs: number;
  status: "UP" | "SLOW" | "DOWN";
}

interface SSLInfo {
  issuer: string;
  expiresAt: string;
  daysLeft: number;
  autoRenew: boolean;
}

interface Incident {
  id: string;
  startedAt: string;
  endedAt: string | null;
  severity: string;
  summary: string | null;
  status: string;
}

/* ------------------------------------------------------------------ */
/*  Mock data generator                                               */
/* ------------------------------------------------------------------ */
function generateMockChecks(count: number): CheckRecord[] {
  const out: CheckRecord[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const pct = Math.random();
    const status: CheckRecord["status"] = pct > 0.94 ? "DOWN" : pct > 0.80 ? "SLOW" : "UP";
    out.push({
      id: `chk-${i}`,
      timestamp: new Date(now - (count - i) * 300000).toISOString(),
      statusCode: status === "DOWN" ? 500 : status === "SLOW" ? 504 : 200,
      responseTimeMs: status === "DOWN" ? 0 : status === "SLOW" ? 2800 + Math.round(Math.random() * 2000) : 120 + Math.round(Math.random() * 500),
      status,
    });
  }
  return out;
}

function generateSSL(): SSLInfo {
  const now = new Date();
  const exp = new Date(now.getTime() + 45 * 86400000 + Math.random() * 100 * 86400000);
  return {
    issuer: "Let's Encrypt",
    expiresAt: exp.toISOString(),
    daysLeft: Math.round((exp.getTime() - now.getTime()) / 86400000),
    autoRenew: true,
  };
}

function generateIncidents(): Incident[] {
  return [
    { id: "i1", startedAt: new Date(Date.now() - 7200000).toISOString(), endedAt: new Date(Date.now() - 6600000).toISOString(), severity: "WARNING", summary: "Response time exceeded 5s threshold", status: "RESOLVED" },
    { id: "i2", startedAt: new Date(Date.now() - 172800000).toISOString(), endedAt: new Date(Date.now() - 172200000).toISOString(), severity: "CRITICAL", summary: "Site unreachable for 3m", status: "RESOLVED" },
  ];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function statusColor(s: CheckRecord["status"]) {
  return s === "DOWN" ? "var(--danger)" : s === "SLOW" ? "var(--warning)" : "var(--success)";
}
function statusLabel(s: CheckRecord["status"]) {
  return s === "DOWN" ? "Down" : s === "SLOW" ? "Slow" : "OK";
}
function severityBadge(s: string) {
  return s === "CRITICAL" ? "danger" as const : "warning" as const;
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */
export default function SiteMonitoringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [site, setSite] = useState<SiteInfo | null>(null);
  const [checks, setChecks] = useState<CheckRecord[]>([]);
  const [ssl, setSsl] = useState<SSLInfo | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");

  useEffect(() => {
    async function fetchData() {
      try {
        const [siteData] = await Promise.all([
          api.get<SiteInfo>(`/sites/${id}`).catch(() => null),
        ]);

        if (!siteData) {
          // Use mock
          setSite({
            id,
            name: id === "1" ? "acme-corp.com" : "bluewave.io",
            domain: id === "1" ? "acme-corp.com" : "bluewave.io",
            siteUrl: `https://${id === "1" ? "acme-corp" : "bluewave"}.com`,
            connectionStatus: "CONNECTED",
            environment: "PRODUCTION",
            wpVersion: "6.7.2",
            phpVersion: "8.3",
          });
        } else {
          setSite(siteData);
        }
      } catch {
        // Mock fallback
        setSite({
          id,
          name: `site-${id}`,
          domain: `site-${id}.com`,
          siteUrl: `https://site-${id}.com`,
          connectionStatus: "CONNECTED",
          environment: "PRODUCTION",
        });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, router]);

  /* Generate mock data when site loads or time range changes */
  useEffect(() => {
    if (!site) return;
    const count = timeRange === "24h" ? 100 : timeRange === "7d" ? 300 : 600;
    Promise.resolve().then(() => {
      setChecks(generateMockChecks(count));
      setSsl(generateSSL());
      setIncidents(generateIncidents());
    });
  }, [site, timeRange, id]);

  /* Stable timestamps for display */
  const firstCheckTs = checks[0]?.timestamp;
  const nowLabel = "Now";

  /* Derived stats */
  const uptimePct = checks.length
    ? ((checks.filter((c) => c.status !== "DOWN").length / checks.length) * 100).toFixed(2)
    : "100";
  const avgResponse = checks.length
    ? Math.round(checks.filter((c) => c.status !== "DOWN").reduce((s, c) => s + c.responseTimeMs, 0) / checks.filter((c) => c.status !== "DOWN").length)
    : 0;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--muted)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <Header title={site?.name || "Monitoring Detail"} subtitle="Per‑site health &amp; uptime">
        <div className="flex items-center gap-[7px]">
          <Link
            href="/monitoring"
            className="inline-flex items-center h-[36px] px-[14px] border border-[var(--border)] bg-[var(--background)] font-semibold text-[13px] hover:bg-[var(--accent)]"
          >
            Back to overview
          </Link>
          <Link
            href={`/sites/${id}`}
            className="inline-flex items-center h-[36px] px-[14px] border border-[var(--border)] bg-[var(--background)] font-semibold text-[13px] hover:bg-[var(--accent)]"
          >
            Site detail
          </Link>
        </div>
      </Header>

      <main className="wpcc-scroll flex-1 overflow-auto bg-[var(--muted)] p-[24px] flex flex-col gap-[16px]">
        {/* Site identity */}
        {site && (
          <div className="flex items-center gap-[11px] mb-[4px]">
            <StatusDot tone="success" />
            <span className="font-heading font-bold text-[20px]">{site.name}</span>
            <Badge tone="danger">{site.environment}</Badge>
            <span className="text-[13px] text-[var(--muted-foreground)] ml-auto">{site.siteUrl}</span>
          </div>
        )}

        {/* Time range selector */}
        <div className="flex gap-[6px]">
          {(["24h", "7d", "30d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`h-[30px] px-[12px] text-[12px] font-semibold border transition-colors ${
                timeRange === r
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                  : "bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--accent)]"
              }`}
            >
              Last {r}
            </button>
          ))}
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-5 gap-[16px]">
          {[
            { label: "Uptime", value: `${uptimePct}%` },
            { label: "Avg response", value: avgResponse, unit: " ms" },
            { label: "Checks", value: checks.length.toLocaleString() },
            { label: "SSL expiry", value: ssl ? `${ssl.daysLeft}d` : "N/A", danger: ssl ? ssl.daysLeft < 30 : false },
            { label: "Incidents", value: incidents.length, danger: incidents.some((i) => i.status === "OPEN") },
          ].map((kpi, i) => (
            <div key={i} className="bg-[var(--card)] border border-[var(--border)] px-[18px] py-[14px]">
              <div className="text-[12px] font-medium text-[var(--muted-foreground)]">{kpi.label}</div>
              <div className="font-heading font-bold text-[24px] mt-[6px] flex items-center gap-[6px]">
                {kpi.value}{kpi.unit || ""}
                {kpi.danger && <span className="w-[8px] h-[8px] rounded-full bg-[var(--danger)]" />}
              </div>
            </div>
          ))}
        </div>

        {/* Response timeline (sparkline bars) */}
        <div className="bg-[var(--card)] border border-[var(--border)]">
          <div className="flex items-center justify-between px-[18px] py-[12px] border-b border-[var(--border)]">
            <span className="font-heading font-semibold text-[15px]">Checks timeline</span>
            <span className="flex items-center gap-[12px] text-[11.5px] text-[var(--muted-foreground)]">
              <span className="flex items-center gap-[4px]"><span className="w-[8px] h-[8px] bg-[var(--success)] inline-block" /> OK</span>
              <span className="flex items-center gap-[4px]"><span className="w-[8px] h-[8px] bg-[var(--warning)] inline-block" /> Slow</span>
              <span className="flex items-center gap-[4px]"><span className="w-[8px] h-[8px] bg-[var(--danger)] inline-block" /> Down</span>
            </span>
          </div>
          <div className="px-[18px] py-[14px]">
            <div className="flex gap-[2px] items-end h-[40px]">
              {checks.slice(-100).map((chk) => (
                <span
                  key={chk.id}
                  className="flex-1 rounded-sm"
                  style={{
                    background: statusColor(chk.status),
                    height: chk.status === "DOWN" ? "40px" : chk.status === "SLOW" ? "26px" : "16px",
                  }}
                  title={`${new Date(chk.timestamp).toLocaleString()} · ${statusLabel(chk.status)} · ${chk.responseTimeMs}ms`}
                />
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-[var(--muted-foreground)] mt-[8px]">
              <span>{firstCheckTs ? new Date(firstCheckTs).toLocaleString() : ""}</span>
              <span>{nowLabel}</span>
            </div>
          </div>
        </div>

        {/* Response time + SSL row */}
        <div className="grid grid-cols-2 gap-[16px]">
          {/* Response time distribution */}
          <div className="bg-[var(--card)] border border-[var(--border)] p-[18px]">
            <h3 className="font-heading font-semibold text-[15px] mb-[12px]">Response time distribution</h3>
            <div className="flex flex-col gap-[6px]">
              {[
                { label: "≤ 500ms", color: "var(--success)", pct: 0 },
                { label: "500ms – 2s", color: "var(--warning)", pct: 0 },
                { label: "≥ 2s", color: "var(--danger)", pct: 0 },
              ].map((b) => {
                const count = checks.filter((c) => {
                  if (b.label.startsWith("≤")) return c.responseTimeMs <= 500 && c.status !== "DOWN";
                  if (b.label.startsWith("≥")) return c.responseTimeMs >= 2000 && c.status !== "DOWN";
                  return c.responseTimeMs > 500 && c.responseTimeMs < 2000 && c.status !== "DOWN";
                }).length;
                const pct = checks.length ? (count / checks.filter((c) => c.status !== "DOWN").length) * 100 : 0;
                return (
                  <div key={b.label}>
                    <div className="flex justify-between text-[12.5px] mb-[4px]">
                      <span>{b.label}</span>
                      <span className="font-semibold">{count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-[8px] bg-[var(--muted)]">
                      <div className="h-full transition-all" style={{ width: `${pct}%`, background: b.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SSL info */}
          <div className="bg-[var(--card)] border border-[var(--border)] p-[18px]">
            <h3 className="font-heading font-semibold text-[15px] mb-[12px]">SSL certificate</h3>
            {ssl && (
              <div className="flex flex-col gap-[10px] text-[13px]">
                <div className="flex justify-between py-[6px] border-b border-[var(--border)]">
                  <span className="text-[var(--muted-foreground)]">Issuer</span>
                  <span className="font-medium">{ssl.issuer}</span>
                </div>
                <div className="flex justify-between py-[6px] border-b border-[var(--border)]">
                  <span className="text-[var(--muted-foreground)]">Expires</span>
                  <span className="font-medium">{new Date(ssl.expiresAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between py-[6px] border-b border-[var(--border)]">
                  <span className="text-[var(--muted-foreground)]">Days left</span>
                  <span className={`font-semibold flex items-center gap-[6px] ${ssl.daysLeft < 30 ? "text-[var(--danger)]" : ""}`}>
                    {ssl.daysLeft}
                    {ssl.daysLeft < 30 && <span className="w-[7px] h-[7px] rounded-full bg-[var(--danger)]" />}
                  </span>
                </div>
                <div className="flex justify-between py-[6px]">
                  <span className="text-[var(--muted-foreground)]">Auto‑renew</span>
                  <span className={`font-medium ${ssl.autoRenew ? "text-[var(--success)]" : ""}`}>
                    {ssl.autoRenew ? "On" : "Off"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent checks table */}
        <div className="bg-[var(--card)] border border-[var(--border)]">
          <div className="px-[18px] py-[12px] border-b border-[var(--border)] font-heading font-semibold text-[15px]">
            Recent checks
          </div>
          <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-[14px] px-[18px] py-[10px] border-b border-[var(--border)] font-heading text-[11px] font-semibold tracking-[0.04em] uppercase text-[var(--muted-foreground)]">
            <span>Timestamp</span><span>Status</span><span>Response</span><span>Code</span>
          </div>
          {checks.slice(-20).reverse().map((chk) => (
            <div key={chk.id} className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-[14px] items-center px-[18px] py-[11px] border-b border-[var(--border)] text-[13px] hover:bg-[var(--accent)]">
              <span className="text-[var(--muted-foreground)]">{new Date(chk.timestamp).toLocaleString()}</span>
              <span className="flex items-center gap-[7px] font-semibold">
                <span className="w-[7px] h-[7px] rounded-full" style={{ background: statusColor(chk.status) }} />
                {statusLabel(chk.status)}
              </span>
              <span className="font-mono text-[12.5px]">{chk.status === "DOWN" ? "—" : `${chk.responseTimeMs} ms`}</span>
              <span className="font-mono text-[12.5px]">{chk.statusCode}</span>
            </div>
          ))}
        </div>

        {/* Incidents for this site */}
        <div className="bg-[var(--card)] border border-[var(--border)]">
          <div className="px-[18px] py-[12px] border-b border-[var(--border)] font-heading font-semibold text-[15px]">
            Incidents
          </div>
          {incidents.length === 0 ? (
            <div className="p-[18px] text-[13px] text-[var(--muted-foreground)]">No incidents recorded for this site</div>
          ) : (
            incidents.map((inc) => (
              <div key={inc.id} className="grid grid-cols-[1.2fr_1.2fr_1fr_90px] gap-[14px] items-center px-[18px] py-[12px] border-b border-[var(--border)] text-[13px] hover:bg-[var(--accent)]">
                <span className="flex items-center gap-[7px] font-semibold">
                  <StatusDot tone={inc.status === "OPEN" ? "danger" : "success"} />
                  {inc.summary || "No summary"}
                </span>
                <span className="text-[var(--muted-foreground)]">{new Date(inc.startedAt).toLocaleString()}</span>
                <span className="text-[var(--muted-foreground)]">
                  {inc.endedAt ? `${Math.round((new Date(inc.endedAt).getTime() - new Date(inc.startedAt).getTime()) / 60000)}m` : "Ongoing"}
                </span>
                <Badge tone={severityBadge(inc.severity)}>{inc.severity}</Badge>
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}
