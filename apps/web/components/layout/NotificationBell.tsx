"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface AlertItem {
  id: string;
  siteName: string;
  event: string;
  time: string;
  isUnread: boolean;
}

const MOCK_ALERTS: AlertItem[] = [
  { id: "1", siteName: "shop.northstar.co", event: "HTTP 503 · Down 42m", time: "13:58", isUnread: true },
  { id: "2", siteName: "bluewave.io", event: "Update failed · Yoast SEO", time: "14:28", isUnread: true },
  { id: "3", siteName: "acme-corp.com", event: "Cache cleared", time: "14:30", isUnread: false },
];

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = alerts.filter((a) => a.isUnread).length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, isUnread: false })));
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-[36px] h-[36px] flex-none border border-[var(--border)] bg-[var(--background)] flex items-center justify-center text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-[8px] right-[9px] w-[7px] h-[7px] rounded-full bg-[var(--danger)] border-[1.5px] border-[var(--background)]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-[4px] w-[360px] bg-[var(--popover)] border border-[var(--border)] shadow-lg z-50">
          <div className="flex items-center justify-between px-[16px] py-[12px] border-b border-[var(--border)]">
            <span className="font-heading font-semibold text-[14px]">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[12px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="px-[16px] py-[24px] text-center text-[13px] text-[var(--muted-foreground)]">
                No notifications
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-[12px] px-[16px] py-[11px] border-b border-[var(--border)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
                >
                  <span
                    className={`w-[8px] h-[8px] flex-none rounded-full mt-[4px] ${
                      alert.isUnread ? "bg-[var(--primary)]" : "bg-transparent border border-[var(--border)]"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--foreground)]">{alert.siteName}</div>
                    <div className="text-[12px] text-[var(--muted-foreground)] mt-[1px]">{alert.event}</div>
                  </div>
                  <span className="text-[11.5px] text-[var(--muted-foreground)] flex-none">{alert.time}</span>
                </div>
              ))
            )}
          </div>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-[16px] py-[10px] text-[12.5px] font-medium text-center text-[var(--muted-foreground)] border-t border-[var(--border)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            Notification settings →
          </Link>
        </div>
      )}
    </div>
  );
}
