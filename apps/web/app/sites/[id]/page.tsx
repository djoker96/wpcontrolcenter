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
}

interface PluginInfo {
  id: string;
  slug: string;
  name: string;
  versionInstalled: string;
  versionLatest: string;
  isActive: boolean;
  updateAvailable: boolean;
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

  // Loading States
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

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
        </div>
      </main>
    </div>
  );
}
