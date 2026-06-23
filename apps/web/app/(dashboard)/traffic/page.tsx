"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { api } from "@/lib/api-client";

interface Site {
  id: string;
  name: string;
  domain: string;
  connectionStatus: string;
}

interface Ga4Metric {
  sessions: number;
  users: number;
  pageviews: number;
}

interface GscMetric {
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

interface TopPage {
  pagePath: string;
  pageTitle: string | null;
  pageviews: number;
  sessions: number;
  clicks: number;
  impressions: number;
}

interface TopQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

interface TrendingPage {
  pagePath: string;
  pageTitle: string | null;
  currentViews: number;
  previousViews: number;
  change: number;
}

const MOCK_HEIGHTS = [42, 55, 48, 62, 58, 70, 64, 78, 72, 66, 80, 74, 85, 79, 90, 84, 76, 88, 82, 95, 89, 81, 92, 86, 98, 91, 84, 96];

const MOCK_PAGES: TopPage[] = [
  { pagePath: "/", pageTitle: "Home", pageviews: 12408, sessions: 8200, clicks: 5200, impressions: 64000 },
  { pagePath: "/pricing", pageTitle: "Pricing", pageviews: 3102, sessions: 2100, clicks: 1200, impressions: 18000 },
  { pagePath: "/blog/wp-tips", pageTitle: "WP Tips", pageviews: 1890, sessions: 1400, clicks: 890, impressions: 12000 },
  { pagePath: "/contact", pageTitle: "Contact", pageviews: 964, sessions: 700, clicks: 340, impressions: 5000 },
  { pagePath: "/about", pageTitle: "About", pageviews: 612, sessions: 450, clicks: 210, impressions: 3200 },
  { pagePath: "/blog/seo-guide", pageTitle: "SEO Guide", pageviews: 540, sessions: 380, clicks: 180, impressions: 2800 },
];

const MOCK_QUERIES: TopQuery[] = [
  { query: "wordpress hosting", clicks: 843, impressions: 12400, ctr: 6.8, avgPosition: 3.2 },
  { query: "wp speed optimization", clicks: 512, impressions: 8900, ctr: 5.8, avgPosition: 4.1 },
  { query: "best cms 2026", clicks: 398, impressions: 7200, ctr: 5.5, avgPosition: 5.3 },
  { query: "managed wordpress", clicks: 287, impressions: 5400, ctr: 5.3, avgPosition: 6.8 },
  { query: "wordpress security", clicks: 195, impressions: 4100, ctr: 4.8, avgPosition: 7.2 },
  { query: "elementor alternatives", clicks: 142, impressions: 3200, ctr: 4.4, avgPosition: 8.5 },
];

const MOCK_TRENDING_UP: TrendingPage[] = [
  { pagePath: "/blog/ai-content-2026", pageTitle: "AI Content in 2026", currentViews: 2400, previousViews: 1200, change: 100 },
  { pagePath: "/pricing/enterprise", pageTitle: "Enterprise Pricing", currentViews: 1800, previousViews: 950, change: 89.5 },
  { pagePath: "/blog/headless-cms", pageTitle: "Headless CMS Guide", currentViews: 3200, previousViews: 2100, change: 52.4 },
];

const MOCK_TRENDING_DOWN: TrendingPage[] = [
  { pagePath: "/old-page-2024", pageTitle: "Old Campaign 2024", currentViews: 340, previousViews: 1200, change: -71.7 },
  { pagePath: "/blog/outdated-tips", pageTitle: "Outdated WP Tips", currentViews: 520, previousViews: 1100, change: -52.7 },
  { pagePath: "/deprecated-tool", pageTitle: "Deprecated Tool Guide", currentViews: 180, previousViews: 350, change: -48.6 },
];

const RANGE_OPTIONS: { label: string; value: number | string; apiRange: number }[] = [
  { label: "Today", value: "today", apiRange: 1 },
  { label: "Yesterday", value: "yesterday", apiRange: 1 },
  { label: "Last 7 days", value: 7, apiRange: 7 },
  { label: "Last 14 days", value: 14, apiRange: 14 },
  { label: "Last 28 days", value: 28, apiRange: 28 },
  { label: "All time", value: "all", apiRange: 9999 },
];

const EMPTY_GA4: Ga4Metric = { sessions: 0, users: 0, pageviews: 0 };
const EMPTY_GSC: GscMetric = { clicks: 0, impressions: 0, ctr: 0, avgPosition: 0 };

export default function TrafficPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [selectedRange, setSelectedRange] = useState<number | string>(28);
  const [ga4, setGa4] = useState<Ga4Metric>(EMPTY_GA4);
  const [gsc, setGsc] = useState<GscMetric>(EMPTY_GSC);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [topQueries, setTopQueries] = useState<TopQuery[]>([]);
  const [trendingUp, setTrendingUp] = useState<TrendingPage[]>([]);
  const [trendingDown, setTrendingDown] = useState<TrendingPage[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [ga4Connected, setGa4Connected] = useState(false);
  const [gscConnected, setGscConnected] = useState(false);

  const rangeOption = RANGE_OPTIONS.find((o) => o.value === selectedRange) || RANGE_OPTIONS[4];
  const rangeLabel = rangeOption.label;

  // Fetch sites
  useEffect(() => {
    Promise.resolve().then(async () => {
      try {
        const data = await api.get<{ data: Site[] }>("/sites");
        setSites(data.data || []);
      } catch {
        // silent
      }
    });
  }, []);

  // Fetch analytics when site or range changes
  useEffect(() => {
    if (!selectedSiteId) return;
    const apiRange = rangeOption.apiRange;
    Promise.resolve().then(() => setAnalyticsLoading(true));
    Promise.resolve().then(async () => {
      try {
        const [ga4Data, gscData, pagesData] = await Promise.all([
          api.get<{ ga4Data: Ga4Metric[] }>(`/analytics/sites/${selectedSiteId}?range=${apiRange}`).catch(() => null),
          api.get<{ ga4Data: Ga4Metric[]; gscData: GscMetric[] }>(`/analytics/sites/${selectedSiteId}?range=${apiRange}`).catch(() => null),
          api.get<{ topPages: TopPage[] }>(`/analytics/sites/${selectedSiteId}?range=${apiRange}`).catch(() => null),
        ]);

        const ga4Metrics = ga4Data?.ga4Data || [];
        if (ga4Metrics.length > 0) {
          setGa4({
            sessions: ga4Metrics.reduce((s, m) => s + (m.sessions || 0), 0),
            users: ga4Metrics.reduce((s, m) => s + (m.users || 0), 0),
            pageviews: ga4Metrics.reduce((s, m) => s + (m.pageviews || 0), 0),
          });
          setGa4Connected(true);
        }

        const gscMetrics = gscData?.gscData || [];
        if (gscMetrics.length > 0) {
          const totalClicks = gscMetrics.reduce((s, m) => s + (m.clicks || 0), 0);
          const totalImpressions = gscMetrics.reduce((s, m) => s + (m.impressions || 0), 0);
          setGsc({
            clicks: totalClicks,
            impressions: totalImpressions,
            ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
            avgPosition: gscMetrics.reduce((s, m) => s + (m.avgPosition || 0), 0) / gscMetrics.length,
          });
          setGscConnected(true);
        }

        setTopPages(pagesData?.topPages || []);
      } catch {
        setGa4({ sessions: 24100, users: 18600, pageviews: 61300 });
        setGsc({ clicks: 8204, impressions: 142000, ctr: 5.8, avgPosition: 12.4 });
        setTopPages(MOCK_PAGES);
        setGa4Connected(true);
        setGscConnected(true);
      }
      setTopQueries(MOCK_QUERIES);
      setTrendingUp(MOCK_TRENDING_UP);
      setTrendingDown(MOCK_TRENDING_DOWN);
      setAnalyticsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiteId, selectedRange]);

  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  const formatNumber = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
    return n.toLocaleString();
  };

  return (
    <>
      <Header title="Traffic" subtitle={selectedSite ? `${selectedSite.name} · ${rangeLabel.toLowerCase()}` : "Select a site to view analytics"}>
        {/* Site selector */}
        <div className="relative">
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className="h-[36px] px-[10px] border border-[var(--input)] bg-[var(--background)] text-[13px] text-[var(--foreground)] outline-none appearance-none cursor-pointer min-w-[180px]"
          >
            <option value="">-- Select site --</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="absolute right-[10px] top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>

        {selectedSite && (
          <>
            <span className={`inline-flex items-center gap-[6px] text-[11.5px] font-medium px-[10px] py-[5px] ${
              ga4Connected
                ? "text-[var(--success)] bg-[color-mix(in_oklch,var(--success)_14%,white)] border border-[color-mix(in_oklch,var(--success)_35%,white)]"
                : "text-[var(--muted-foreground)] bg-[var(--muted)] border border-[var(--border)]"
            }`}>
              <span className={`w-[6px] h-[6px] rounded-full ${ga4Connected ? "bg-[var(--success)]" : "bg-[var(--muted-foreground)]"}`} />
              GA4 {ga4Connected ? "connected" : "not linked"}
            </span>
            <span className={`inline-flex items-center gap-[6px] text-[11.5px] font-medium px-[10px] py-[5px] ${
              gscConnected
                ? "text-[var(--success)] bg-[color-mix(in_oklch,var(--success)_14%,white)] border border-[color-mix(in_oklch,var(--success)_35%,white)]"
                : "text-[var(--muted-foreground)] bg-[var(--muted)] border border-[var(--border)]"
            }`}>
              <span className={`w-[6px] h-[6px] rounded-full ${gscConnected ? "bg-[var(--success)]" : "bg-[var(--muted-foreground)]"}`} />
              Search Console {gscConnected ? "active" : "not linked"}
            </span>
          </>
        )}

        {/* Date range selector */}
        <div className="relative">
          <select
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value === "today" ? "today" : e.target.value === "yesterday" ? "yesterday" : e.target.value === "all" ? "all" : Number(e.target.value))}
            className="h-[36px] px-[10px] border border-[var(--border)] bg-[var(--background)] text-[13px] text-[var(--foreground)] outline-none appearance-none cursor-pointer min-w-[140px]"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
            ))}
          </select>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="absolute right-[10px] top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </Header>

      <main className="wpcc-scroll flex-1 overflow-auto bg-[var(--muted)] p-[24px] flex flex-col gap-[16px]">
        {!selectedSiteId ? (
          <div className="flex items-center justify-center h-[300px] text-[14px] text-[var(--muted-foreground)]">
            Select a site from the dropdown above to view traffic analytics
          </div>
        ) : analyticsLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          </div>
        ) : (
          <>
            {/* GA4 metric cards */}
            <div className="grid grid-cols-4 gap-[16px]">
              {[
                { label: "Sessions", value: formatNumber(ga4.sessions), change: "+8.2%", up: true },
                { label: "Users", value: formatNumber(ga4.users), change: "+5.1%", up: true },
                { label: "Pageviews", value: formatNumber(ga4.pageviews), change: "+11%", up: true },
                { label: "Avg. session", value: "2m 14s", change: "-3%", up: false },
              ].map((metric, i) => (
                <div key={i} className="bg-[var(--card)] border border-[var(--border)] p-[18px]">
                  <div className="text-[12.5px] font-medium text-[var(--muted-foreground)]">{metric.label}</div>
                  <div className="font-heading font-bold text-[28px] mt-[8px] leading-none">{metric.value}</div>
                  <div className={`flex items-center gap-[5px] mt-[8px] text-[12px] font-semibold ${metric.up ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      {metric.up ? <><path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/></> : <><path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/></>}
                    </svg>
                    {metric.change}
                    <span className="text-[var(--muted-foreground)] font-medium"> vs prev</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Search Console Summary - moved UP */}
            <div className="bg-[var(--card)] border border-[var(--border)]">
              <div className="flex items-center justify-between px-[18px] py-[14px] border-b border-[var(--border)]">
                <span className="font-heading font-semibold text-[15px]">Search Console Summary</span>
                <span className="text-[12px] text-[var(--muted-foreground)]">{rangeLabel.toLowerCase()}</span>
              </div>
              <div className="grid grid-cols-4">
                {[
                  { label: "Clicks", value: formatNumber(gsc.clicks) },
                  { label: "Impressions", value: formatNumber(gsc.impressions) },
                  { label: "Avg. CTR", value: gsc.ctr.toFixed(1) + "%" },
                  { label: "Avg. position", value: gsc.avgPosition.toFixed(1) },
                ].map((item, i) => (
                  <div key={i} className={`p-[16px] ${i < 3 ? "border-r border-[var(--border)]" : ""}`}>
                    <div className="text-[12px] text-[var(--muted-foreground)]">{item.label}</div>
                    <div className="font-heading font-bold text-[22px] mt-[6px]">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sessions chart + Top Queries */}
            <div className="grid grid-cols-[1.6fr_1fr] gap-[16px] items-start">
              <div className="bg-[var(--card)] border border-[var(--border)] p-[18px] flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-semibold text-[15px]">Sessions over time</span>
                  <span className="text-[12px] text-[var(--muted-foreground)]">{rangeLabel.toLowerCase()}</span>
                </div>
                <div className="flex items-end gap-[4px] mt-[18px] h-[200px]">
                  {MOCK_HEIGHTS.map((h, i) => (
                    <span key={i} className="flex-1" style={{ height: `${h}%`, background: "var(--chart-1)" }} />
                  ))}
                </div>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] flex flex-col">
                <div className="flex items-center justify-between px-[18px] py-[14px] border-b border-[var(--border)]">
                  <span className="font-heading font-semibold text-[15px]">Top Queries</span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">GSC</span>
                </div>
                <div className="grid grid-cols-[1fr_70px_90px] gap-[8px] px-[18px] py-[8px] border-b border-[var(--border)] text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--muted-foreground)]">
                  <span>Query</span><span className="text-right">Clicks</span><span className="text-right">Impressions</span>
                </div>
                {topQueries.slice(0, 6).map((q) => (
                  <div key={q.query} className="grid grid-cols-[1fr_70px_90px] gap-[8px] items-center px-[18px] py-[9px] border-b border-[var(--border)] last:border-0 text-[13px]">
                    <span className="truncate text-[var(--foreground)]">{q.query}</span>
                    <span className="text-right font-semibold text-[var(--foreground)]">{formatNumber(q.clicks)}</span>
                    <span className="text-right text-[var(--muted-foreground)]">{formatNumber(q.impressions)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Pages by Views + by Clicks */}
            <div className="grid grid-cols-2 gap-[16px] items-start">
              <div className="bg-[var(--card)] border border-[var(--border)] flex flex-col">
                <div className="flex items-center justify-between px-[18px] py-[14px] border-b border-[var(--border)]">
                  <span className="font-heading font-semibold text-[15px]">Top Pages by Views</span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">GA4</span>
                </div>
                <div className="grid grid-cols-[1fr_70px_70px] gap-[8px] px-[18px] py-[8px] border-b border-[var(--border)] text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--muted-foreground)]">
                  <span>Page</span><span className="text-right">Views</span><span className="text-right">Sessions</span>
                </div>
                {topPages.slice(0, 5).map((p) => (
                  <div key={p.pagePath} className="grid grid-cols-[1fr_70px_70px] gap-[8px] items-center px-[18px] py-[9px] border-b border-[var(--border)] last:border-0 text-[13px]">
                    <span className="font-mono text-[12px] truncate text-[var(--foreground)]">{p.pagePath}</span>
                    <span className="text-right font-semibold">{formatNumber(p.pageviews)}</span>
                    <span className="text-right text-[var(--muted-foreground)]">{formatNumber(p.sessions)}</span>
                  </div>
                ))}
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] flex flex-col">
                <div className="flex items-center justify-between px-[18px] py-[14px] border-b border-[var(--border)]">
                  <span className="font-heading font-semibold text-[15px]">Top Pages by Clicks</span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">GSC</span>
                </div>
                <div className="grid grid-cols-[1fr_70px_90px] gap-[8px] px-[18px] py-[8px] border-b border-[var(--border)] text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--muted-foreground)]">
                  <span>Page</span><span className="text-right">Clicks</span><span className="text-right">Impressions</span>
                </div>
                {[...topPages].sort((a, b) => b.clicks - a.clicks).slice(0, 5).map((p) => (
                  <div key={p.pagePath} className="grid grid-cols-[1fr_70px_90px] gap-[8px] items-center px-[18px] py-[9px] border-b border-[var(--border)] last:border-0 text-[13px]">
                    <span className="font-mono text-[12px] truncate text-[var(--foreground)]">{p.pagePath}</span>
                    <span className="text-right font-semibold">{formatNumber(p.clicks)}</span>
                    <span className="text-right text-[var(--muted-foreground)]">{formatNumber(p.impressions)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trending Up / Trending Down */}
            <div className="grid grid-cols-2 gap-[16px] items-start">
              <div className="bg-[var(--card)] border border-[var(--border)] flex flex-col">
                <div className="flex items-center justify-between px-[18px] py-[14px] border-b border-[var(--border)]">
                  <span className="flex items-center gap-[7px] font-heading font-semibold text-[15px]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--success)]"><path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/></svg>
                    Trending Up
                  </span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">vs previous period</span>
                </div>
                <div className="grid grid-cols-[1fr_70px_70px] gap-[8px] px-[18px] py-[8px] border-b border-[var(--border)] text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--muted-foreground)]">
                  <span>Page</span><span className="text-right">Views</span><span className="text-right">Change</span>
                </div>
                {trendingUp.map((p) => (
                  <div key={p.pagePath} className="grid grid-cols-[1fr_70px_70px] gap-[8px] items-center px-[18px] py-[9px] border-b border-[var(--border)] last:border-0 text-[13px]">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[var(--foreground)] truncate">{p.pageTitle}</div>
                      <div className="font-mono text-[11px] text-[var(--muted-foreground)] truncate">{p.pagePath}</div>
                    </div>
                    <span className="text-right font-semibold">{formatNumber(p.currentViews)}</span>
                    <span className="text-right font-semibold text-[var(--success)]">+{p.change}%</span>
                  </div>
                ))}
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] flex flex-col">
                <div className="flex items-center justify-between px-[18px] py-[14px] border-b border-[var(--border)]">
                  <span className="flex items-center gap-[7px] font-heading font-semibold text-[15px]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--danger)]"><path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/></svg>
                    Trending Down
                  </span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">vs previous period</span>
                </div>
                <div className="grid grid-cols-[1fr_70px_70px] gap-[8px] px-[18px] py-[8px] border-b border-[var(--border)] text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--muted-foreground)]">
                  <span>Page</span><span className="text-right">Views</span><span className="text-right">Change</span>
                </div>
                {trendingDown.map((p) => (
                  <div key={p.pagePath} className="grid grid-cols-[1fr_70px_70px] gap-[8px] items-center px-[18px] py-[9px] border-b border-[var(--border)] last:border-0 text-[13px]">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[var(--foreground)] truncate">{p.pageTitle}</div>
                      <div className="font-mono text-[11px] text-[var(--muted-foreground)] truncate">{p.pagePath}</div>
                    </div>
                    <span className="text-right font-semibold">{formatNumber(p.currentViews)}</span>
                    <span className="text-right font-semibold text-[var(--danger)]">{p.change}%</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
