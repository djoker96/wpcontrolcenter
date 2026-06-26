"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api-client";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  result: string;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; email: string; fullName: string | null } | null;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await api.get<{ data: AuditEntry[] }>("/audit-logs?take=50");
        Promise.resolve().then(() => setLogs(data.data || []));
      } catch {
        // silent
      } finally {
        Promise.resolve().then(() => setLoading(false));
      }
    }
    fetchData();
  }, []);

  const getResultBadge = (result: string) => {
    switch (result) {
      case "SUCCESS": return "success" as const;
      case "FAILURE": return "danger" as const;
      default: return "neutral" as const;
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    // eslint-disable-next-line react-hooks/purity
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const formatAction = (action: string) => {
    return action
      .replace(/^site\./, "")
      .replace(/\./g, " · ")
      .replace(/-/g, " ");
  };

  return (
    <>
      <Header
        title="Audit log"
        subtitle="All actions and their results"
      >
        <div className="flex items-center gap-[8px] h-[36px] px-[12px] border border-[var(--border)] bg-[var(--background)] text-[13px] font-medium">
          User: All
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-foreground)]"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        <div className="flex items-center gap-[8px] h-[36px] px-[12px] border border-[var(--border)] bg-[var(--background)] text-[13px] font-medium">
          Action: All
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-foreground)]"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        <div className="inline-flex items-center gap-[7px] h-[36px] px-[14px] border border-[var(--border)] bg-[var(--background)] font-semibold text-[13px] cursor-pointer hover:bg-[var(--accent)]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          Export
        </div>
      </Header>

      <main className="wpcc-scroll flex-1 overflow-auto bg-[var(--muted)] p-[24px]">
        <div className="bg-[var(--card)] border border-[var(--border)]">
          {/* Table header */}
          <div className="grid grid-cols-[80px_110px_1.3fr_1.9fr_120px] gap-[14px] px-[18px] py-[10px] border-b border-[var(--border)] font-heading text-[11px] font-semibold tracking-[0.04em] uppercase text-[var(--muted-foreground)]">
            <span>Time</span><span>User</span><span>Action</span><span>Target</span><span>Result</span>
          </div>

          {/* Rows */}
          {loading ? (
            <div className="p-[24px] text-center text-[13px] text-[var(--muted-foreground)]">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="p-[24px] text-center text-[13px] text-[var(--muted-foreground)]">No audit entries found</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="grid grid-cols-[80px_110px_1.3fr_1.9fr_120px] gap-[14px] items-center px-[18px] py-[12px] border-b border-[var(--border)] text-[13px] hover:bg-[var(--accent)] transition-colors">
                <span className="text-[var(--muted-foreground)] text-[12.5px]">{getTimeAgo(log.createdAt)}</span>
                <span className="font-medium text-[var(--foreground)]">{log.user?.email || "system"}</span>
                <span className="font-semibold text-[var(--foreground)]">{formatAction(log.action)}</span>
                <span className="text-[var(--muted-foreground)] text-[12.5px] truncate">
                  {log.entityType ? `${log.entityType} · ${log.entityId?.slice(0, 16)}…` : "—"}
                </span>
                <span>
                  <Badge tone={getResultBadge(log.result)}>{log.result}</Badge>
                </span>
              </div>
            ))
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between px-[18px] py-[13px] text-[12.5px] text-[var(--muted-foreground)]">
            <span>Showing {Math.min(logs.length, 50)} of {logs.length} entries</span>
            <span className="flex gap-[8px]">
              <span className="inline-flex items-center justify-center w-[30px] h-[30px] border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] cursor-pointer hover:bg-[var(--accent)]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </span>
              <span className="inline-flex items-center justify-center w-[30px] h-[30px] border border-[var(--border)] bg-[var(--background)] cursor-pointer hover:bg-[var(--accent)]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </span>
            </span>
          </div>
        </div>
      </main>
    </>
  );
}
