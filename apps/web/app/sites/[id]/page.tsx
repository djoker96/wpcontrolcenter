"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface SiteOverview {
  name: string;
  siteUrl: string;
  domain: string;
  connectionStatus: string;
  wpVersion?: string;
  phpVersion?: string;
  lastSeenAt?: string;
  pluginsCount?: number;
  activePluginsCount?: number;
  pluginUpdatesAvailable?: number;
  themeUpdatesAvailable?: number;
  timezone?: string;
  wpAgentVersion?: string;
  coreUpdateAvailable?: boolean;
  coreVersionLatest?: string | null;
  ga4PropertyId?: string | null;
  gscSiteUrl?: string | null;
}

interface Ga4Metric {
  id: string;
  siteId: string;
  metricDate: string;
  source: string;
  sessions: number | null;
  users: number | null;
  pageviews: number | null;
}

interface GscMetric {
  id: string;
  siteId: string;
  metricDate: string;
  source: string;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  avgPosition: number | null;
}

interface TopPageMetric {
  pagePath: string;
  pageTitle: string | null;
  pageviews: number;
  sessions: number;
  clicks: number;
  impressions: number;
}

interface IntegrationAccount {
  id: string;
  provider: string;
  accountEmail: string | null;
  status: string;
  createdAt: string;
}

interface Ga4Property {
  id: string;
  name: string;
  accountName: string;
}

interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}


interface PluginInfo {
  id: string;
  slug: string;
  name: string;
  versionInstalled: string;
  versionLatest: string;
  isActive: boolean;
  updateAvailable: boolean;
  autoUpdateEnabled?: boolean;
}

interface ThemeInfo {
  id: string;
  slug: string;
  name: string;
  versionInstalled: string;
  versionLatest: string;
  isActive: boolean;
  updateAvailable: boolean;
}

interface CoreInfo {
  versionInstalled: string;
  versionLatest: string;
  updateAvailable: boolean;
}

interface UptimeCheckInfo {
  id: string;
  checkedAt: string;
  statusCode: number | null;
  responseTimeMs: number | null;
  isUp: boolean;
  errorMessage: string | null;
}

interface IncidentInfo {
  id: string;
  incidentType: string;
  severity: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  summary: string | null;
}

export default function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  // Tab State
  const [activeTab, setActiveTab] = useState("overview");

  // Site Data State
  const [overviewData, setOverviewData] = useState<SiteOverview | null>(null);
  const [pluginsData, setPluginsData] = useState<PluginInfo[]>([]);
  const [themesData, setThemesData] = useState<ThemeInfo[]>([]);
  const [coreData, setCoreData] = useState<CoreInfo | null>(null);
  const [uptimeRatio, setUptimeRatio] = useState<number>(100);
  const [uptimeChecks, setUptimeChecks] = useState<UptimeCheckInfo[]>([]);
  const [incidentsList, setIncidentsList] = useState<IncidentInfo[]>([]);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  // Maintenance State
  const [robotsContent, setRobotsContent] = useState("");
  const [htaccessContent, setHtaccessContent] = useState("");
  const [phpMemoryLimit, setPhpMemoryLimit] = useState("256M");
  const [pluginSlugToInstall, setPluginSlugToInstall] = useState("");
  const [actionRunning, setActionRunning] = useState(false);

  // Analytics State
  const [ga4AnalyticsData, setGa4AnalyticsData] = useState<Ga4Metric[]>([]);
  const [gscAnalyticsData, setGscAnalyticsData] = useState<GscMetric[]>([]);
  const [topPagesData, setTopPagesData] = useState<TopPageMetric[]>([]);
  const [integrationAccounts, setIntegrationAccounts] = useState<IntegrationAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [availableProperties, setAvailableProperties] = useState<Ga4Property[]>([]);
  const [availableGscSites, setAvailableGscSites] = useState<GscSite[]>([]);
  const [selectedGa4PropertyId, setSelectedGa4PropertyId] = useState("");
  const [selectedGscSiteUrl, setSelectedGscSiteUrl] = useState("");
  const [mappingLoading, setMappingLoading] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState(30);
  const [isEditingConnection, setIsEditingConnection] = useState(false);

  // Server Diagnostics State
  interface DiagnosticsData {
    sslExpiresAt: string | null;
    sslIssuer: string | null;
    sslStatus: string | null;
    diskTotalBytes: number | null;
    diskUsedBytes: number | null;
    cronHealthStatus: string;
    cronDetailsJson: Array<{ hook: string; schedule: number; delay_seconds: number; schedule_name: string }> | null;
    lastDiagnosticsAt: string;
  }

  const [diagnosticsData, setDiagnosticsData] = useState<DiagnosticsData | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [refreshingDiagnostics, setRefreshingDiagnostics] = useState(false);

  // PHP Error Logs State
  const [phpLogs, setPhpLogs] = useState("");
  const [phpLogsLines, setPhpLogsLines] = useState(100);
  const [loadingPhpLogs, setLoadingPhpLogs] = useState(false);

  const handleMapSite = async () => {
    const token = localStorage.getItem("wpcc_token");
    if (!token || !selectedAccountId) return;

    setMappingLoading(true);
    setError("");
    try {
      const res = await fetch(`http://localhost:3003/api/integrations/sites/${id}/map`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accountId: selectedAccountId,
          ga4PropertyId: selectedGa4PropertyId || null,
          gscSiteIdentifier: selectedGscSiteUrl || null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to link Google properties to site");
      }

      alert("Site mapped successfully!");
      setIsEditingConnection(false);
      await fetchData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Mapping failed";
      setError(errorMsg);
    } finally {
      setMappingLoading(false);
    }
  };
  useEffect(() => {
    if (!selectedAccountId) return;
    const fetchProperties = async () => {
      const token = localStorage.getItem("wpcc_token");
      if (!token) return;
      try {
        const res = await fetch(`http://localhost:3003/api/integrations/google/properties?accountId=${selectedAccountId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setAvailableProperties(json.ga4Properties || []);
          setAvailableGscSites(json.gscSites || []);
        }
      } catch (err) {
        console.error("Failed to fetch Google properties", err);
      }
    };
    fetchProperties();
  }, [selectedAccountId]);

  const fetchAnalyticsTab = async (range = analyticsRange) => {
    const token = localStorage.getItem("wpcc_token");
    if (!token) return;

    try {
      const accountsRes = await fetch("http://localhost:3003/api/integrations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (accountsRes.ok) {
        const json = await accountsRes.json();
        const accountsList = json.data || [];
        setIntegrationAccounts(accountsList);
        if (accountsList.length > 0 && !selectedAccountId) {
          setSelectedAccountId(accountsList[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load integration accounts", err);
    }

    if (overviewData?.ga4PropertyId || overviewData?.gscSiteUrl) {
      try {
        const analyticsRes = await fetch(`http://localhost:3003/api/analytics/sites/${id}?range=${range}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (analyticsRes.ok) {
          const json = await analyticsRes.json();
          setGa4AnalyticsData(json.ga4Data || []);
          setGscAnalyticsData(json.gscData || []);
          setTopPagesData(json.topPages || []);
        }
      } catch (err) {
        console.error("Failed to load site analytics metrics", err);
      }
    }
  };

  useEffect(() => {
    if (activeTab === "analytics") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAnalyticsTab(analyticsRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, analyticsRange, overviewData?.ga4PropertyId, overviewData?.gscSiteUrl]);

  const fetchDiagnostics = async () => {
    const token = localStorage.getItem("wpcc_token");
    if (!token) return;

    setLoadingDiagnostics(true);
    setError("");
    try {
      const res = await fetch(`http://localhost:3003/api/sites/${id}/diagnostics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load site diagnostics");
      const json = await res.json();
      setDiagnosticsData(json.diagnostics);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load diagnostics";
      setError(errorMsg);
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  const refreshDiagnosticsData = async () => {
    const token = localStorage.getItem("wpcc_token");
    if (!token) return;

    setRefreshingDiagnostics(true);
    setError("");
    try {
      const res = await fetch(`http://localhost:3003/api/sites/${id}/diagnostics/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || "Failed to refresh diagnostics");
      }
      const json = await res.json();
      setDiagnosticsData(json.data);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to refresh diagnostics";
      setError(errorMsg);
    } finally {
      setRefreshingDiagnostics(false);
    }
  };

  const fetchPhpLogsData = async (linesNum = phpLogsLines) => {
    const token = localStorage.getItem("wpcc_token");
    if (!token) return;

    setLoadingPhpLogs(true);
    try {
      const res = await fetch(`http://localhost:3003/api/sites/${id}/diagnostics/php-logs?lines=${linesNum}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || "Failed to fetch PHP error logs");
      }
      const json = await res.json();
      setPhpLogs(json.content || "No PHP error logs found.");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch logs";
      setPhpLogs(`Error: ${errorMsg}`);
    } finally {
      setLoadingPhpLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === "diagnostics") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchDiagnostics();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchPhpLogsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const triggerMaintenanceAction = async (action: string, payload: Record<string, unknown> = {}) => {
    const token = localStorage.getItem("wpcc_token");
    if (!token) return;

    setActionRunning(true);
    setError("");
    try {
      const res = await fetch(`http://localhost:3003/api/sites/${id}/actions/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || `Action ${action} failed`);
      }

      const data = await res.json();
      alert(`Maintenance Job Queued! Job ID: ${data.jobId}. Check Audit Log or reload shortly.`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Action failed.";
      setError(errorMsg);
    } finally {
      setActionRunning(false);
    }
  };

  const fetchData = async () => {
    const token = localStorage.getItem("wpcc_token");
    if (!token) {
      router.push("/");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Fetch overview
      const overviewRes = await fetch(`http://localhost:3003/api/sites/${id}/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!overviewRes.ok) throw new Error("Failed to load overview data");
      const overviewJson = await overviewRes.json();
      setOverviewData(overviewJson.summary);

      // Fetch plugins
      const pluginsRes = await fetch(`http://localhost:3003/api/sites/${id}/plugins`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (pluginsRes.ok) {
        const pluginsJson = await pluginsRes.json();
        setPluginsData(pluginsJson.data || []);
      }

      // Fetch themes
      const themesRes = await fetch(`http://localhost:3003/api/sites/${id}/themes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (themesRes.ok) {
        const themesJson = await themesRes.json();
        setThemesData(themesJson.data || []);
      }

      // Fetch core
      const coreRes = await fetch(`http://localhost:3003/api/sites/${id}/core`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (coreRes.ok) {
        const coreJson = await coreRes.json();
        setCoreData(coreJson);
      }

      // Fetch Uptime
      const uptimeRes = await fetch(`http://localhost:3003/api/sites/${id}/uptime`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (uptimeRes.ok) {
        const uptimeJson = await uptimeRes.json();
        setUptimeRatio(uptimeJson.uptimeRatio);
        setUptimeChecks(uptimeJson.data || []);
      }

      // Fetch Incidents
      const incidentsRes = await fetch(`http://localhost:3003/api/sites/${id}/incidents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (incidentsRes.ok) {
        const incidentsJson = await incidentsRes.json();
        setIncidentsList(incidentsJson.data || []);
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred while loading data.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSync = async () => {
    const token = localStorage.getItem("wpcc_token");
    if (!token) return;

    setSyncing(true);
    setError("");

    try {
      const response = await fetch(`http://localhost:3003/api/sites/${id}/resync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Failed to resync inventory");
      }

      await fetchData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Could not resync with WordPress site. Make sure it is online and the plugin is connected.";
      setError(errorMsg);
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !overviewData) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-950 text-zinc-200">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-zinc-950 text-zinc-200 font-sans">
      {/* Top Navigation */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/sites" className="text-zinc-400 hover:text-white transition text-sm">
              ← Back to Sites
            </Link>
            <span className="text-zinc-700">|</span>
            <span className="text-lg font-bold text-white font-heading">
              {overviewData?.name || "Site Detail"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold px-4 py-2"
            >
              {syncing ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border border-violet-500 border-t-transparent" />
                  Syncing...
                </span>
              ) : (
                "Sync Now"
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl p-6">
        {error && (
          <div className="mb-6 rounded-lg border border-red-900/30 bg-red-950/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Site Profile Summary */}
        <div className="mb-8 rounded-xl border border-zinc-900 bg-zinc-900/20 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Site URL</div>
            <a
              href={overviewData?.siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-semibold text-violet-400 hover:underline break-all"
            >
              {overviewData?.siteUrl}
            </a>
            <div className="text-xs text-zinc-500">
              Domain: <code className="text-zinc-400">{overviewData?.domain}</code>
            </div>
          </div>

          <div className="grid grid-cols-2 md:flex items-center gap-6 text-sm">
            <div className="border-l border-zinc-800 pl-4">
              <div className="text-zinc-500 text-xs">Connection</div>
              <div className="mt-1 font-semibold text-emerald-400">{overviewData?.connectionStatus}</div>
            </div>
            <div className="border-l border-zinc-800 pl-4">
              <div className="text-zinc-500 text-xs">WordPress</div>
              <div className="mt-1 font-semibold text-white">{overviewData?.wpVersion || "Unknown"}</div>
            </div>
            <div className="border-l border-zinc-800 pl-4">
              <div className="text-zinc-500 text-xs">PHP Version</div>
              <div className="mt-1 font-semibold text-white">{overviewData?.phpVersion || "Unknown"}</div>
            </div>
            <div className="border-l border-zinc-800 pl-4">
              <div className="text-zinc-500 text-xs">Last Seen</div>
              <div className="mt-1 font-semibold text-zinc-300">
                {overviewData?.lastSeenAt ? new Date(overviewData.lastSeenAt).toLocaleTimeString() : "Never"}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-zinc-900 mb-6 flex gap-4 overflow-x-auto">
          {[
            { id: "overview", label: "Overview" },
            { id: "plugins", label: `Plugins (${pluginsData.length})` },
            { id: "themes", label: `Themes (${themesData.length})` },
            { id: "core", label: "Core Version" },
            { id: "uptime", label: `Uptime & Incidents (${incidentsList.filter(i => i.status === "OPEN").length})` },
            { id: "maintenance", label: "Maintenance & Tools" },
            { id: "analytics", label: "Analytics & SEO" },
            { id: "diagnostics", label: "Server Diagnostics" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? "border-violet-500 text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Panels */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6">
          {activeTab === "overview" && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white font-heading">Inventory Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-4">
                    <div className="text-zinc-500 text-xs">Plugins Installed</div>
                    <div className="text-2xl font-bold text-white mt-1">{overviewData?.pluginsCount || 0}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-4">
                    <div className="text-zinc-500 text-xs">Active Plugins</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">{overviewData?.activePluginsCount || 0}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-4">
                    <div className="text-zinc-500 text-xs">Plugin Updates</div>
                    <div className="text-2xl font-bold text-yellow-500 mt-1">{overviewData?.pluginUpdatesAvailable || 0}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-4">
                    <div className="text-zinc-500 text-xs">Theme Updates</div>
                    <div className="text-2xl font-bold text-yellow-500 mt-1">{overviewData?.themeUpdatesAvailable || 0}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white font-heading">System Properties</h3>
                <div className="divide-y divide-zinc-900 text-sm">
                  <div className="flex justify-between py-2.5">
                    <span className="text-zinc-500">WordPress Timezone</span>
                    <span className="text-zinc-300 font-semibold">{overviewData?.timezone || "Not set"}</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-zinc-500">WP Agent Version</span>
                    <span className="text-zinc-300 font-semibold">{overviewData?.wpAgentVersion || "None"}</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-zinc-500">Core Update Status</span>
                    <span className={`font-semibold ${overviewData?.coreUpdateAvailable ? "text-yellow-500" : "text-emerald-400"}`}>
                      {overviewData?.coreUpdateAvailable ? "Upgrade Available" : "Up to date"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "plugins" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white font-heading">Installed Plugins</h3>
              </div>

              {pluginsData.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm">No plugin inventory sync data available.</div>
              ) : (
                <div className="divide-y divide-zinc-900">
                  {pluginsData.map((plugin) => (
                    <div key={plugin.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          {plugin.name}
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            plugin.isActive
                              ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30"
                              : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                          }`}>
                            {plugin.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5 font-mono">{plugin.slug}</div>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-right">
                          <div className="text-xs text-zinc-500">Installed Version</div>
                          <div className="text-white font-semibold">{plugin.versionInstalled}</div>
                        </div>

                        {plugin.updateAvailable && (
                          <div className="rounded border border-yellow-900/50 bg-yellow-950/30 px-2.5 py-1 text-xs text-yellow-500">
                            Update to {plugin.versionLatest} available
                          </div>
                        )}

                        <div className="text-right">
                          <div className="text-xs text-zinc-500">Auto-Update</div>
                          <div className="text-zinc-400">{plugin.autoUpdateEnabled ? "On" : "Off"}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "themes" && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white font-heading">Installed Themes</h3>

              {themesData.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm">No theme inventory sync data available.</div>
              ) : (
                <div className="divide-y divide-zinc-900">
                  {themesData.map((theme) => (
                    <div key={theme.id} className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          {theme.name}
                          {theme.isActive && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-900/30">
                              Active Theme
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5 font-mono">{theme.slug}</div>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-right">
                          <div className="text-xs text-zinc-500">Installed Version</div>
                          <div className="text-white font-semibold">{theme.versionInstalled}</div>
                        </div>

                        {theme.updateAvailable && (
                          <div className="rounded border border-yellow-900/50 bg-yellow-950/30 px-2.5 py-1 text-xs text-yellow-500">
                            Update to {theme.versionLatest} available
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "core" && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white font-heading">WordPress Core Version</h3>

              <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <div className="text-xs text-zinc-500">Currently Installed</div>
                  <div className="text-3xl font-extrabold text-white mt-1 font-heading">
                    {coreData?.versionInstalled || "Unknown"}
                  </div>
                </div>

                {coreData?.updateAvailable ? (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-yellow-900/50 bg-yellow-950/20 p-4 text-sm text-yellow-500">
                      An update is available! Latest WordPress core version:{" "}
                      <strong className="text-white font-bold">{coreData?.versionLatest}</strong>.
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-400">
                    Your WordPress core version is fully up to date!
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "uptime" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-lg font-bold text-white font-heading">Uptime & Outages</h3>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 flex items-center gap-2">
                  <span className="text-zinc-500 text-xs uppercase font-semibold">24h Uptime Ratio</span>
                  <span className={`text-lg font-extrabold ${uptimeRatio >= 99 ? "text-emerald-400" : "text-yellow-500"}`}>
                    {uptimeRatio}%
                  </span>
                </div>
              </div>

              {/* Incidents Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Incidents Registry</h4>
                {incidentsList.length === 0 ? (
                  <div className="rounded-lg border border-zinc-900 bg-zinc-950/40 p-4 text-center text-zinc-500 text-sm">
                    No incidents logged for this site.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/20">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-900 bg-zinc-900/40 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                          <th className="p-4">Incident Type</th>
                          <th className="p-4">Summary</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {incidentsList.map((inc) => (
                          <tr key={inc.id} className="hover:bg-zinc-900/30 transition">
                            <td className="p-4 font-mono font-semibold text-white">{inc.incidentType}</td>
                            <td className="p-4 text-zinc-300">{inc.summary || "No description provided"}</td>
                            <td className="p-4">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                inc.status === "OPEN"
                                  ? "bg-red-950/40 text-red-400 border border-red-900/30"
                                  : "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30"
                              }`}>
                                {inc.status}
                              </span>
                            </td>
                            <td className="p-4 text-zinc-400 text-xs">
                              <div>Start: {new Date(inc.startedAt).toLocaleString()}</div>
                              {inc.endedAt ? (
                                <div>End: {new Date(inc.endedAt).toLocaleString()}</div>
                              ) : (
                                <div className="text-red-400">Active (Ongoing)</div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Ping Log History */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Recent Ping Logs</h4>
                {uptimeChecks.length === 0 ? (
                  <div className="rounded-lg border border-zinc-900 bg-zinc-950/40 p-4 text-center text-zinc-500 text-sm">
                    No ping checks recorded yet.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/20">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-900 bg-zinc-900/40 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                          <th className="p-4">Timestamp</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Response Time</th>
                          <th className="p-4">Log</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {uptimeChecks.map((check) => (
                          <tr key={check.id} className="hover:bg-zinc-900/30 transition">
                            <td className="p-4 text-zinc-400 text-xs">{new Date(check.checkedAt).toLocaleString()}</td>
                            <td className="p-4">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                                check.isUp
                                  ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30"
                                  : "bg-red-950/40 text-red-400 border border-red-900/30"
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${
                                  check.isUp ? "bg-emerald-500" : "bg-red-500"
                                }`} />
                                {check.isUp ? "ONLINE" : "OFFLINE"}
                              </span>
                            </td>
                            <td className="p-4 text-white font-semibold">
                              {check.responseTimeMs !== null ? `${check.responseTimeMs} ms` : "—"}
                            </td>
                            <td className="p-4 text-zinc-400 text-xs">
                              {check.errorMessage || `HTTP ${check.statusCode || "OK"}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "maintenance" && (
            <div className="space-y-8">
              {/* Core Utilities */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                  <h4 className="text-md font-bold text-white font-heading">Cache Clean</h4>
                  <p className="text-xs text-zinc-500">Flush WordPress object cache, transient data, and static files.</p>
                  <Button
                    onClick={() => triggerMaintenanceAction("clear-cache")}
                    disabled={actionRunning}
                    className="bg-violet-600 hover:bg-violet-500 text-white"
                  >
                    Flush Site Cache
                  </Button>
                </div>

                <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                  <h4 className="text-md font-bold text-white font-heading">Optimize Database</h4>
                  <p className="text-xs text-zinc-500">Run OPTIMIZE TABLE on all active WordPress tables.</p>
                  <Button
                    onClick={() => triggerMaintenanceAction("optimize-database")}
                    disabled={actionRunning}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Run DB Optimization
                  </Button>
                </div>
              </div>

              {/* Plugin Installer */}
              <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                <h4 className="text-md font-bold text-white font-heading">Remote Plugin Installer</h4>
                <p className="text-xs text-zinc-500">Download and install plugins directly from WordPress.org repository.</p>
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={pluginSlugToInstall}
                    onChange={(e) => setPluginSlugToInstall(e.target.value)}
                    placeholder="e.g. contact-form-7"
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-sm text-white placeholder-zinc-600 outline-none"
                  />
                  <Button
                    onClick={() => {
                      triggerMaintenanceAction("install-plugin", { slug: pluginSlugToInstall });
                      setPluginSlugToInstall("");
                    }}
                    disabled={actionRunning || !pluginSlugToInstall}
                    className="bg-violet-600 hover:bg-violet-500 text-white"
                  >
                    Install Plugin
                  </Button>
                </div>
              </div>

              {/* Configurations Editor */}
              <div className="space-y-6">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">File Editors</h4>
                
                {/* Robots.txt */}
                <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                  <h5 className="font-semibold text-white">robots.txt</h5>
                  <textarea
                    value={robotsContent}
                    onChange={(e) => setRobotsContent(e.target.value)}
                    placeholder="User-agent: *&#10;Disallow: /wp-admin/"
                    rows={4}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-white font-mono outline-none"
                  />
                  <Button
                    onClick={() => triggerMaintenanceAction("update-robots-txt", { content: robotsContent })}
                    disabled={actionRunning}
                    className="bg-violet-600 hover:bg-violet-500 text-white"
                  >
                    Save robots.txt
                  </Button>
                </div>

                {/* .htaccess */}
                <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                  <h5 className="font-semibold text-white">.htaccess</h5>
                  <p className="text-xs text-zinc-500">Saves a backup copy as .htaccess.bak automatically before saving.</p>
                  <textarea
                    value={htaccessContent}
                    onChange={(e) => setHtaccessContent(e.target.value)}
                    placeholder="# Begin WordPress"
                    rows={6}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-white font-mono outline-none"
                  />
                  <Button
                    onClick={() => triggerMaintenanceAction("update-htaccess", { content: htaccessContent })}
                    disabled={actionRunning}
                    className="bg-violet-600 hover:bg-violet-500 text-white"
                  >
                    Save .htaccess
                  </Button>
                </div>

                {/* PHP config */}
                <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                  <h5 className="font-semibold text-white">PHP local config (.user.ini)</h5>
                  <div className="flex gap-4 items-center">
                    <span className="text-xs text-zinc-400">Memory Limit</span>
                    <select
                      value={phpMemoryLimit}
                      onChange={(e) => setPhpMemoryLimit(e.target.value)}
                      className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-sm text-white outline-none"
                    >
                      <option value="128M">128M</option>
                      <option value="256M">256M</option>
                      <option value="512M">512M</option>
                    </select>
                    <Button
                      onClick={() => triggerMaintenanceAction("update-php-config", { settings: { memory_limit: phpMemoryLimit } })}
                      disabled={actionRunning}
                      className="bg-violet-600 hover:bg-violet-500 text-white"
                    >
                      Apply Config
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Top Controls & Mapped Status */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-900 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white font-heading">Google Analytics & Search Console</h3>
                  {overviewData?.ga4PropertyId || overviewData?.gscSiteUrl ? (
                    <p className="text-xs text-zinc-500 mt-1">
                      Connected to GA4 Property: <code className="text-violet-400 font-semibold">{overviewData.ga4PropertyId || "None"}</code> | GSC Site: <code className="text-violet-400 font-semibold">{overviewData.gscSiteUrl || "None"}</code>
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-500 mt-1">
                      This site is not connected to Google services. Use the configuration form below to map it.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 font-medium">Time Range:</span>
                    <select
                      value={analyticsRange}
                      onChange={(e) => setAnalyticsRange(Number(e.target.value))}
                      className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-white outline-none focus:border-violet-500 transition"
                    >
                      <option value={7}>Last 7 Days</option>
                      <option value={30}>Last 30 Days</option>
                      <option value={90}>Last 90 Days</option>
                    </select>
                  </div>

                  {(overviewData?.ga4PropertyId || overviewData?.gscSiteUrl) && !isEditingConnection && (
                    <Button
                      onClick={() => {
                        setIsEditingConnection(true);
                        setSelectedGa4PropertyId(overviewData.ga4PropertyId || "");
                        setSelectedGscSiteUrl(overviewData.gscSiteUrl || "");
                      }}
                      className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 text-zinc-300 font-semibold text-xs px-3 py-1.5"
                    >
                      Configure Connection
                    </Button>
                  )}
                </div>
              </div>

              {/* Connection Form (if not mapped or if editing connection) */}
              {(!overviewData?.ga4PropertyId && !overviewData?.gscSiteUrl) || isEditingConnection ? (
                <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-6 space-y-6 max-w-2xl mx-auto backdrop-blur-md">
                  <div className="space-y-1">
                    <h4 className="text-md font-bold text-white">Link Google Properties</h4>
                    <p className="text-xs text-zinc-500">
                      Select a connected Google Account to map this website with a Google Analytics 4 Property and Google Search Console Site.
                    </p>
                  </div>

                  {integrationAccounts.length === 0 ? (
                    <div className="rounded-lg border border-yellow-950/20 bg-yellow-950/5 p-6 text-center space-y-4">
                      <p className="text-xs text-yellow-500">No Google integration accounts connected.</p>
                      <Link href="/integrations">
                        <Button className="bg-violet-600 hover:bg-violet-500 text-xs px-4 py-2 text-white">
                          Manage Integrations
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Account Selection */}
                      <div className="space-y-2">
                        <label className="text-xs text-zinc-400 font-semibold block">Google Account</label>
                        <select
                          value={selectedAccountId}
                          onChange={(e) => setSelectedAccountId(e.target.value)}
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-sm text-white outline-none focus:border-violet-500 transition"
                        >
                          <option value="">-- Select Account --</option>
                          {integrationAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.accountEmail} ({acc.provider})
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedAccountId && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* GA4 Property Selection */}
                          <div className="space-y-2">
                            <label className="text-xs text-zinc-400 font-semibold block">Google Analytics 4 Property</label>
                            <select
                              value={selectedGa4PropertyId}
                              onChange={(e) => setSelectedGa4PropertyId(e.target.value)}
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-sm text-white outline-none focus:border-violet-500 transition"
                            >
                              <option value="">-- Do not link GA4 --</option>
                              {availableProperties.map((prop) => (
                                <option key={prop.id} value={prop.id}>
                                  {prop.name} ({prop.id})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* GSC Site Selection */}
                          <div className="space-y-2">
                            <label className="text-xs text-zinc-400 font-semibold block">Google Search Console Site</label>
                            <select
                              value={selectedGscSiteUrl}
                              onChange={(e) => setSelectedGscSiteUrl(e.target.value)}
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-sm text-white outline-none focus:border-violet-500 transition"
                            >
                              <option value="">-- Do not link GSC --</option>
                              {availableGscSites.map((site) => (
                                <option key={site.siteUrl} value={site.siteUrl}>
                                  {site.siteUrl}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <Button
                          onClick={handleMapSite}
                          disabled={mappingLoading || !selectedAccountId}
                          className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold py-2.5"
                        >
                          {mappingLoading ? "Saving Mapping..." : "Save Property Connections"}
                        </Button>
                        {isEditingConnection && (
                          <Button
                            onClick={() => setIsEditingConnection(false)}
                            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 text-xs px-4"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Connected & Analytics Metrics Display */
                <div className="space-y-8">
                  {/* KPI Cards Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    {/* Sessions */}
                    <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-4 backdrop-blur-sm">
                      <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">GA4 Sessions</div>
                      <div className="text-2xl font-extrabold text-white mt-1 font-heading">
                        {ga4AnalyticsData.reduce((sum, d) => sum + (d.sessions || 0), 0).toLocaleString()}
                      </div>
                    </div>
                    {/* Active Users */}
                    <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-4 backdrop-blur-sm">
                      <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">GA4 Active Users</div>
                      <div className="text-2xl font-extrabold text-emerald-400 mt-1 font-heading">
                        {ga4AnalyticsData.reduce((sum, d) => sum + (d.users || 0), 0).toLocaleString()}
                      </div>
                    </div>
                    {/* Pageviews */}
                    <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-4 backdrop-blur-sm">
                      <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">GA4 Pageviews</div>
                      <div className="text-2xl font-extrabold text-white mt-1 font-heading">
                        {ga4AnalyticsData.reduce((sum, d) => sum + (d.pageviews || 0), 0).toLocaleString()}
                      </div>
                    </div>
                    {/* Clicks */}
                    <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-4 backdrop-blur-sm">
                      <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">GSC Clicks</div>
                      <div className="text-2xl font-extrabold text-white mt-1 font-heading">
                        {gscAnalyticsData.reduce((sum, d) => sum + (d.clicks || 0), 0).toLocaleString()}
                      </div>
                    </div>
                    {/* Impressions */}
                    <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-4 backdrop-blur-sm">
                      <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">GSC Impressions</div>
                      <div className="text-2xl font-extrabold text-fuchsia-400 mt-1 font-heading">
                        {gscAnalyticsData.reduce((sum, d) => sum + (d.impressions || 0), 0).toLocaleString()}
                      </div>
                    </div>
                    {/* Avg Position */}
                    <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-4 backdrop-blur-sm">
                      <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Avg Position</div>
                      <div className="text-2xl font-extrabold text-yellow-500 mt-1 font-heading">
                        {gscAnalyticsData.length > 0
                          ? (gscAnalyticsData.reduce((sum, d) => sum + (d.avgPosition || 0), 0) / gscAnalyticsData.length).toFixed(1)
                          : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Graphs section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* GA4 Traffic Chart */}
                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-semibold text-white">GA4 Traffic Trends</h4>
                        <div className="flex gap-4 text-xs font-medium">
                          <span className="flex items-center gap-1.5 text-violet-400">
                            <span className="h-2 w-2 rounded-full bg-violet-500" />
                            Sessions
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Active Users
                          </span>
                        </div>
                      </div>
                      <div className="h-44 relative bg-zinc-900/20 rounded-lg p-2 border border-zinc-900">
                        <div className="absolute inset-0 opacity-40">
                          <MiniLineChart data={ga4AnalyticsData} dataKey="sessions" color="#8b5cf6" strokeWidth={2} />
                        </div>
                        <div className="absolute inset-0">
                          <MiniLineChart data={ga4AnalyticsData} dataKey="users" color="#10b981" strokeWidth={1.5} />
                        </div>
                      </div>
                    </div>

                    {/* GSC Performance Chart */}
                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-semibold text-white">Google Search Console Performance</h4>
                        <div className="flex gap-4 text-xs font-medium">
                          <span className="flex items-center gap-1.5 text-white">
                            <span className="h-2 w-2 rounded-full bg-white" />
                            Clicks
                          </span>
                          <span className="flex items-center gap-1.5 text-fuchsia-400">
                            <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
                            Impressions
                          </span>
                        </div>
                      </div>
                      <div className="h-44 relative bg-zinc-900/20 rounded-lg p-2 border border-zinc-900">
                        <div className="absolute inset-0 opacity-40">
                          <MiniLineChart data={gscAnalyticsData} dataKey="impressions" color="#d946ef" strokeWidth={1.5} />
                        </div>
                        <div className="absolute inset-0">
                          <MiniLineChart data={gscAnalyticsData} dataKey="clicks" color="#ffffff" strokeWidth={2} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Pages Table */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Top Visited Pages (GA4 & GSC Summary)</h4>
                    {topPagesData.length === 0 ? (
                      <div className="rounded-lg border border-zinc-900 bg-zinc-950/40 p-6 text-center text-zinc-500 text-sm">
                        No page metrics synced yet.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/10 backdrop-blur-sm">
                        <table className="w-full border-collapse text-left text-sm">
                          <thead>
                            <tr className="border-b border-zinc-900 bg-zinc-900/40 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                              <th className="p-4">Page Path</th>
                              <th className="p-4">Page Title</th>
                              <th className="p-4 text-right">GA4 Pageviews</th>
                              <th className="p-4 text-right">GA4 Sessions</th>
                              <th className="p-4 text-right">GSC Clicks</th>
                              <th className="p-4 text-right">GSC Impressions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900">
                            {topPagesData.map((page, index) => (
                              <tr key={index} className="hover:bg-zinc-900/30 transition duration-150">
                                <td className="p-4 font-mono text-zinc-300 break-all select-all text-xs">{page.pagePath}</td>
                                <td className="p-4 text-white truncate max-w-xs text-xs">{page.pageTitle || "—"}</td>
                                <td className="p-4 text-right text-emerald-400 font-semibold font-mono text-xs">{page.pageviews.toLocaleString()}</td>
                                <td className="p-4 text-right text-zinc-300 font-mono text-xs">{page.sessions.toLocaleString()}</td>
                                <td className="p-4 text-right text-white font-semibold font-mono text-xs">{page.clicks.toLocaleString()}</td>
                                <td className="p-4 text-right text-fuchsia-400 font-mono text-xs">{page.impressions.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "diagnostics" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white font-heading">Server Diagnostics & Resources</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Monitor server disk usage, SSL health, WordPress Crons, and view PHP logs.
                  </p>
                </div>
                <Button
                  onClick={refreshDiagnosticsData}
                  disabled={refreshingDiagnostics}
                  className="bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2"
                >
                  {refreshingDiagnostics ? "Refreshing..." : "Refresh Diagnostics"}
                </Button>
              </div>

              {loadingDiagnostics && !diagnosticsData ? (
                <div className="text-zinc-500 text-sm py-4">Loading diagnostics data...</div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                      <h4 className="text-sm font-semibold text-white">Disk Space Usage</h4>
                      {diagnosticsData?.diskTotalBytes ? (
                        <div className="space-y-4">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-zinc-400">Used: {(diagnosticsData.diskUsedBytes! / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                            <span className="text-zinc-400">Total: {(diagnosticsData.diskTotalBytes! / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                          </div>
                          <div className="w-full bg-zinc-900 rounded-full h-3.5 overflow-hidden border border-zinc-850">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                (diagnosticsData.diskUsedBytes! / diagnosticsData.diskTotalBytes!) >= 0.9 
                                  ? 'bg-red-500' 
                                  : (diagnosticsData.diskUsedBytes! / diagnosticsData.diskTotalBytes!) >= 0.75 
                                  ? 'bg-yellow-500' 
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${(diagnosticsData.diskUsedBytes! / diagnosticsData.diskTotalBytes!) * 100}%` }}
                            />
                          </div>
                          <div className="text-right text-xs font-mono text-zinc-500">
                            {((diagnosticsData.diskUsedBytes! / diagnosticsData.diskTotalBytes!) * 100).toFixed(1)}% Capacity Used
                          </div>
                        </div>
                      ) : (
                        <div className="text-zinc-600 text-xs italic">No disk space data synced. Connect agent first.</div>
                      )}
                    </div>

                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                      <h4 className="text-sm font-semibold text-white">SSL Certificate Status</h4>
                      {diagnosticsData?.sslStatus ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              diagnosticsData.sslStatus === 'VALID' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' :
                              diagnosticsData.sslStatus === 'EXPIRING_SOON' ? 'bg-yellow-950/40 text-yellow-500 border border-yellow-900/30' :
                              'bg-red-950/40 text-red-400 border border-red-900/30'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                diagnosticsData.sslStatus === 'VALID' ? 'bg-emerald-500' :
                                diagnosticsData.sslStatus === 'EXPIRING_SOON' ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`} />
                              {diagnosticsData.sslStatus}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                            <div className="text-zinc-500">Issuer:</div>
                            <div className="text-zinc-300 truncate" title={diagnosticsData.sslIssuer || ''}>{diagnosticsData.sslIssuer || 'Unknown'}</div>
                            <div className="text-zinc-500">Expires At:</div>
                            <div className="text-zinc-300">
                              {diagnosticsData.sslExpiresAt ? new Date(diagnosticsData.sslExpiresAt).toLocaleDateString() : '—'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-zinc-650 text-xs italic">No SSL data available. Domain checker starting soon.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-semibold text-white">WordPress Cron Health</h4>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        diagnosticsData?.cronHealthStatus === 'OK' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' :
                        'bg-yellow-950/40 text-yellow-500 border border-yellow-900/30'
                      }`}>
                        {diagnosticsData?.cronHealthStatus === 'OK' ? 'Healthy (No Late Crons)' : 'Late Jobs Detected'}
                      </span>
                    </div>

                    {diagnosticsData?.cronDetailsJson && diagnosticsData.cronDetailsJson.length > 0 ? (
                      <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/10">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-b border-zinc-900 bg-zinc-900/40 text-zinc-400 font-semibold uppercase">
                              <th className="p-3">Hook Name</th>
                              <th className="p-3">Schedule Name</th>
                              <th className="p-3 text-right">Delay (Seconds)</th>
                              <th className="p-3 text-right">Scheduled Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900 font-mono text-zinc-300">
                            {diagnosticsData.cronDetailsJson.map((job, idx) => (
                              <tr key={idx} className="hover:bg-zinc-900/20">
                                <td className="p-3 font-semibold text-white">{job.hook}</td>
                                <td className="p-3">{job.schedule_name}</td>
                                <td className="p-3 text-right text-yellow-500">{job.delay_seconds.toLocaleString()}s</td>
                                <td className="p-3 text-right text-zinc-500">{new Date(job.schedule * 1000).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-zinc-600 text-xs italic text-center py-2">No late cron jobs. All scheduled tasks running normally.</div>
                    )}
                  </div>

                  <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-semibold text-white">PHP Error Log Viewer</h4>
                      <div className="flex items-center gap-3">
                        <select 
                          value={phpLogsLines}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setPhpLogsLines(val);
                            fetchPhpLogsData(val);
                          }}
                          className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-1.5 text-xs text-white outline-none focus:border-violet-500 transition"
                        >
                          <option value="50">Last 50 lines</option>
                          <option value="100">Last 100 lines</option>
                          <option value="200">Last 200 lines</option>
                          <option value="500">Last 500 lines</option>
                        </select>
                        <Button
                          onClick={() => fetchPhpLogsData(phpLogsLines)}
                          disabled={loadingPhpLogs}
                          className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs py-1.5"
                        >
                          {loadingPhpLogs ? "Loading..." : "Refresh Logs"}
                        </Button>
                      </div>
                    </div>

                    <div className="relative font-mono text-xs rounded-xl border border-zinc-900 bg-zinc-900/50 p-4 h-80 overflow-y-auto select-all text-zinc-300 whitespace-pre-wrap">
                      {loadingPhpLogs && !phpLogs ? (
                        <div className="text-zinc-600 text-center py-20 italic">Streaming PHP error logs...</div>
                      ) : (
                        phpLogs || "PHP error logs empty or logging not configured."
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MiniLineChart({ data, dataKey, color, strokeWidth = 2 }: { data: any[], dataKey: string, color: string, strokeWidth?: number }) {
  if (!data || data.length === 0) {
    return <div className="h-full flex items-center justify-center text-xs text-zinc-600 font-medium">No data points</div>;
  }
  
  const width = 500;
  const height = 150;
  const paddingX = 15;
  const paddingY = 15;
  
  const maxVal = Math.max(...data.map(d => Number(d[dataKey]) || 0), 1);
  const minVal = 0;
  
  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * (width - paddingX * 2);
    const val = Number(d[dataKey]) || 0;
    const y = height - paddingY - ((val - minVal) / (maxVal - minVal)) * (height - paddingY * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`gradient-${dataKey}-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      {/* Dynamic Area Under Curve */}
      {data.length > 1 && (
        <polygon
          points={`${paddingX},${height - paddingY} ${points} ${width - paddingX},${height - paddingY}`}
          fill={`url(#gradient-${dataKey}-${color.replace("#", "")})`}
        />
      )}
      {/* Path Line */}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
