"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface IntegrationAccount {
  id: string;
  provider: string;
  accountEmail: string | null;
  status: string;
  createdAt: string;
}

function IntegrationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<IntegrationAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchAccounts = useCallback(async () => {
    const token = localStorage.getItem("wpcc_token");
    if (!token) {
      router.push("/");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("http://localhost:3003/api/integrations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load integrations");
      const json = await res.json();
      setAccounts(json.data || []);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAccounts();
  }, [fetchAccounts]);

  const handleCallback = useCallback(async (code: string) => {
    const token = localStorage.getItem("wpcc_token");
    if (!token) return;

    setConnecting(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("http://localhost:3003/api/integrations/google/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        throw new Error("Failed to connect Google account");
      }

      setSuccessMsg("Google account connected successfully!");
      // Clean query parameters from URL
      router.replace("/integrations");
      await fetchAccounts();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "OAuth callback processing failed.";
      setError(errorMsg);
    } finally {
      setConnecting(false);
    }
  }, [router, fetchAccounts]);

  // Handle OAuth Redirect Callback
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleCallback(code);
    }
  }, [searchParams, handleCallback]);

  const handleConnectGoogle = async () => {
    const token = localStorage.getItem("wpcc_token");
    if (!token) return;

    setConnecting(true);
    setError("");
    try {
      const res = await fetch("http://localhost:3003/api/integrations/google/connect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to generate connect URL");
      const json = await res.json();
      if (json.authorizationUrl) {
        window.location.href = json.authorizationUrl;
      } else {
        throw new Error("Missing authorization URL");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to start Google connection";
      setError(errorMsg);
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans p-8">
      <main className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex justify-between items-center">
          <div>
            <Link href="/sites" className="text-zinc-500 hover:text-white text-sm flex items-center gap-1.5 transition">
              ← Back to Sites
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-heading mt-2">
              Service Integrations
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Connect external services like Google to sync Analytics and Search Console data.
            </p>
          </div>
        </div>

        {/* Success/Error Alerts */}
        {error && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-400">
            {successMsg}
          </div>
        )}

        {/* Integration Panel */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex gap-4 items-center">
              <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                {/* Google Icon */}
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.41 0-6.177-2.767-6.177-6.177 0-3.41 2.767-6.177 6.177-6.177 1.636 0 3.09.636 4.182 1.677l3.26-3.26C19.227 1.84 15.995 1 12.24 1 5.48 1 0 6.48 0 13.24s5.48 12.24 12.24 12.24c6.94 0 12.24-4.87 12.24-12.24 0-.82-.07-1.6-.2-2.355H12.24z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-heading">Google Workspace</h3>
                <p className="text-xs text-zinc-500">Read-only access to Google Analytics 4 and Google Search Console.</p>
              </div>
            </div>
            <Button
              onClick={handleConnectGoogle}
              disabled={connecting}
              className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-6 py-2.5 rounded-lg transition"
            >
              {connecting ? "Connecting..." : "Connect Google"}
            </Button>
          </div>

          <div className="border-t border-zinc-900 pt-6">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4">Connected Accounts</h4>
            
            {loading ? (
              <div className="text-zinc-500 text-sm">Loading connected accounts...</div>
            ) : accounts.length === 0 ? (
              <div className="text-zinc-600 text-sm italic">No Google accounts connected yet.</div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/10">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-900 bg-zinc-900/40 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      <th className="p-4">Provider</th>
                      <th className="p-4">Account Email</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Connected At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {accounts.map((account) => (
                      <tr key={account.id} className="hover:bg-zinc-900/20 transition">
                        <td className="p-4 font-semibold text-white">{account.provider}</td>
                        <td className="p-4 text-zinc-300 font-mono">{account.accountEmail || "Unknown"}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            account.status === "ACTIVE"
                              ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30"
                              : "bg-red-950/40 text-red-400 border border-red-900/30"
                          }`}>
                            {account.status}
                          </span>
                        </td>
                        <td className="p-4 text-zinc-500 text-xs">{new Date(account.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-200">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    }>
      <IntegrationsContent />
    </Suspense>
  );
}
