"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

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
    try {
      const data = await api.get<{ data: IntegrationAccount[] }>("/integrations");
      setAccounts(data.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchAccounts());
  }, [fetchAccounts]);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) return;
    Promise.resolve().then(() => setConnecting(true));
    api.post("/integrations/google/callback", { code })
      .then(() => {
        setSuccessMsg("Google account connected successfully!");
        router.replace("/settings/integrations");
        fetchAccounts();
      })
      .catch((err) => setError(err.message || "OAuth failed"))
      .finally(() => setConnecting(false));
  }, [searchParams, router, fetchAccounts]);

  const handleConnectGoogle = async () => {
    setConnecting(true);
    setError("");
    try {
      const data = await api.post<{ authorizationUrl: string }>("/integrations/google/connect");
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setConnecting(false);
    }
  };

  return (
    <>
      <Header title="Integrations" subtitle="Connect external services" />
      <main className="wpcc-scroll flex-1 overflow-auto bg-[var(--muted)] p-[24px]">
        <div className="max-w-[800px] mx-auto flex flex-col gap-[20px]">
          {error && (
            <div className="px-[16px] py-[12px] border border-[var(--danger)] bg-[color-mix(in_oklch,var(--danger)_12%,white)] text-[13px] text-[var(--danger)]">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="px-[16px] py-[12px] border border-[var(--success)] bg-[color-mix(in_oklch,var(--success)_14%,white)] text-[13px] text-[var(--success)]">
              {successMsg}
            </div>
          )}

          {/* Google Integration Panel */}
          <div className="bg-[var(--card)] border border-[var(--border)] p-[24px]">
            <div className="flex items-start justify-between gap-[16px]">
              <div className="flex gap-[16px] items-start">
                <div className="w-[48px] h-[48px] flex-none bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center">
                  <svg className="w-[24px] h-[24px]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.41 0-6.177-2.767-6.177-6.177 0-3.41 2.767-6.177 6.177-6.177 1.636 0 3.09.636 4.182 1.677l3.26-3.26C19.227 1.84 15.995 1 12.24 1 5.48 1 0 6.48 0 13.24s5.48 12.24 12.24 12.24c6.94 0 12.24-4.87 12.24-12.24 0-.82-.07-1.6-.2-2.355H12.24z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-[16px]">Google Workspace</h3>
                  <p className="text-[12px] text-[var(--muted-foreground)] mt-[2px]">Read-only access to Google Analytics 4 and Google Search Console.</p>
                </div>
              </div>
              <Button onClick={handleConnectGoogle} disabled={connecting}>
                {connecting ? "Connecting..." : "Connect Google"}
              </Button>
            </div>

            <div className="mt-[24px] pt-[24px] border-t border-[var(--border)]">
              <h4 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-foreground)] mb-[16px]">Connected Accounts</h4>
              {loading ? (
                <div className="text-[13px] text-[var(--muted-foreground)]">Loading...</div>
              ) : accounts.length === 0 ? (
                <div className="text-[13px] text-[var(--muted-foreground)] italic">No Google accounts connected yet.</div>
              ) : (
                <div className="border border-[var(--border)]">
                  <div className="grid grid-cols-[1fr_1.5fr_100px_1fr] gap-[12px] px-[16px] py-[10px] border-b border-[var(--border)] text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted-foreground)]">
                    <span>Provider</span><span>Email</span><span>Status</span><span>Connected</span>
                  </div>
                  {accounts.map((acc) => (
                    <div key={acc.id} className="grid grid-cols-[1fr_1.5fr_100px_1fr] gap-[12px] items-center px-[16px] py-[12px] border-b border-[var(--border)] last:border-0 text-[13px]">
                      <span className="font-semibold">{acc.provider}</span>
                      <span className="font-mono text-[var(--muted-foreground)]">{acc.accountEmail || "Unknown"}</span>
                      <span><Badge tone={acc.status === "ACTIVE" ? "success" : "danger"}>{acc.status}</Badge></span>
                      <span className="text-[12px] text-[var(--muted-foreground)]">{new Date(acc.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default function IntegrationsPage() {
  return <IntegrationsContent />;
}
