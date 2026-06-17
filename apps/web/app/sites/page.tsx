"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Site {
  id: string;
  name: string;
  domain: string;
  siteUrl: string;
  environment: string;
  connectionStatus: string;
  wpVersion?: string;
  phpVersion?: string;
}

export default function SitesPage() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [environment, setEnvironment] = useState("PRODUCTION");
  const [submitting, setSubmitting] = useState(false);
  const [createdToken, setCreatedToken] = useState("");
  const [createdSiteName, setCreatedSiteName] = useState("");

  const fetchSites = async () => {
    const token = localStorage.getItem("wpcc_token");
    if (!token) {
      router.push("/");
      return;
    }

    try {
      const response = await fetch("http://localhost:3003/api/sites", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("wpcc_token");
          router.push("/");
          return;
        }
        throw new Error("Failed to load sites");
      }

      const body = await response.json();
      setSites(body.data || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Could not load sites.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchSites();
    });
  }, []);

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const token = localStorage.getItem("wpcc_token");
    try {
      const response = await fetch("http://localhost:3003/api/sites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, domain, siteUrl, environment }),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Failed to create site");
      }

      const body = await response.json();
      setCreatedToken(body.connectionToken || "");
      setCreatedSiteName(body.name || "");
      
      // Reset form
      setName("");
      setDomain("");
      setSiteUrl("");
      setEnvironment("PRODUCTION");
      
      // Refresh sites
      fetchSites();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to add site";
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("wpcc_token");
    localStorage.removeItem("wpcc_user");
    router.push("/");
  };

  // Compute aggregate stats
  const totalSites = sites.length;
  const connectedSites = sites.filter(s => s.connectionStatus === "CONNECTED").length;
  const pendingSites = sites.filter(s => s.connectionStatus === "PENDING").length;

  return (
    <div className="min-h-svh bg-zinc-950 text-zinc-200 font-sans">
      {/* Top Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-xl font-bold text-transparent font-heading">
              WP Control Center
            </span>
            <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-500">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="text-sm text-zinc-400 hover:text-zinc-200 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="mx-auto max-w-7xl p-6">
        {/* Metric Cards */}
        <div className="grid gap-6 sm:grid-cols-3 mb-8">
          <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-6 backdrop-blur">
            <div className="text-zinc-500 text-xs uppercase tracking-wider">Total Sites</div>
            <div className="text-4xl font-bold mt-2 font-heading text-white">{totalSites}</div>
          </div>
          <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-6 backdrop-blur">
            <div className="text-zinc-500 text-xs uppercase tracking-wider">Connected Sites</div>
            <div className="text-4xl font-bold mt-2 font-heading text-emerald-400">{connectedSites}</div>
          </div>
          <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-6 backdrop-blur">
            <div className="text-zinc-500 text-xs uppercase tracking-wider">Pending Connect</div>
            <div className="text-4xl font-bold mt-2 font-heading text-yellow-500">{pendingSites}</div>
          </div>
        </div>

        {/* Action Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white font-heading">WordPress Sites</h2>
            <p className="text-sm text-zinc-400">Monitor and manage connected instances.</p>
          </div>
          <Button
            onClick={() => {
              setCreatedToken("");
              setModalOpen(true);
            }}
            className="bg-violet-600 hover:bg-violet-500 text-white active:scale-95 transition"
          >
            Add Site
          </Button>
        </div>

        {/* Site Table or List */}
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-900/30 bg-red-950/20 p-4 text-center text-red-400">
            {error}
          </div>
        ) : sites.length === 0 ? (
          <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-12 text-center">
            <div className="text-zinc-500 text-sm">No WordPress sites found. Add one to get started!</div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/20">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/40 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  <th className="p-4">Site Name</th>
                  <th className="p-4">Domain</th>
                  <th className="p-4">Environment</th>
                  <th className="p-4">Versions</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {sites.map((site) => (
                  <tr key={site.id} className="hover:bg-zinc-900/30 transition">
                    <td className="p-4 font-semibold text-white">
                      <Link href={`/sites/${site.id}`} className="hover:text-violet-400 transition">
                        {site.name}
                      </Link>
                    </td>
                    <td className="p-4 text-zinc-400">
                      <a href={site.siteUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {site.domain}
                      </a>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        site.environment === "PRODUCTION"
                          ? "bg-red-950/40 text-red-400 border border-red-900/30"
                          : site.environment === "STAGING"
                          ? "bg-yellow-950/40 text-yellow-500 border border-yellow-900/30"
                          : "bg-blue-950/40 text-blue-400 border border-blue-900/30"
                      }`}>
                        {site.environment}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-400">
                      {site.connectionStatus === "CONNECTED" ? (
                        <div className="text-xs">
                          <div>WP: {site.wpVersion || "unknown"}</div>
                          <div>PHP: {site.phpVersion || "unknown"}</div>
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        site.connectionStatus === "CONNECTED"
                          ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          site.connectionStatus === "CONNECTED" ? "bg-emerald-500" : "bg-zinc-500"
                        }`} />
                        {site.connectionStatus}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/sites/${site.id}`}
                        className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Add Site Dialog Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white font-heading">Add New Website</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {createdToken ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-400">
                  Site &quot;{createdSiteName}&quot; created successfully! Copy the Connection Token below to configure the WordPress Agent plugin.
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Connection Token (One-time use)
                  </label>
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                    <code className="flex-1 text-xs select-all text-violet-400 break-all font-mono">
                      {createdToken}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(createdToken)}
                      className="text-xs text-zinc-400 hover:text-white border border-zinc-800 rounded px-2 py-1 bg-zinc-900"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => {
                      setModalOpen(false);
                      setCreatedToken("");
                    }}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white"
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddSite} className="space-y-4">
                {error && (
                  <div className="rounded-lg border border-red-900/30 bg-red-950/20 p-3 text-xs text-red-400">
                    {error}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Production Blog"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-sm text-zinc-200 outline-none transition focus:border-violet-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Domain</label>
                  <input
                    type="text"
                    required
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="example.com"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-sm text-zinc-200 outline-none transition focus:border-violet-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Site URL</label>
                  <input
                    type="url"
                    required
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-sm text-zinc-200 outline-none transition focus:border-violet-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Environment</label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-sm text-zinc-200 outline-none transition focus:border-violet-500/50"
                  >
                    <option value="PRODUCTION">Production</option>
                    <option value="STAGING">Staging</option>
                    <option value="DEVELOPMENT">Development</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-lg border border-zinc-800 bg-transparent px-4 py-2 text-sm text-zinc-400 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2"
                  >
                    {submitting ? "Adding..." : "Add Website"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
