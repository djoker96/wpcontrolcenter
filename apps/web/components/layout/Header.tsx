"use client";

import { NotificationBell } from "./NotificationBell";
import Link from "next/link";

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function Header({ title, subtitle, children }: HeaderProps) {
  return (
    <header className="h-[60px] flex-none border-b border-[var(--border)] px-[24px] flex items-center justify-between gap-[16px] bg-[var(--background)]">
      <div>
        <div className="font-heading font-bold text-[20px] tracking-tight leading-tight">
          {title}
        </div>
        {subtitle && (
          <div className="text-[12px] text-[var(--muted-foreground)] mt-[1px]">{subtitle}</div>
        )}
      </div>
      <div className="flex items-center gap-[10px]">
        {children}
        <NotificationBell />
        <Link
          href="/sites/add"
          className="inline-flex items-center gap-[7px] h-[36px] px-[15px] bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-[13.5px] hover:opacity-90 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Add site
        </Link>
      </div>
    </header>
  );
}
