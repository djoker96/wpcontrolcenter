"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeTone?: "primary" | "muted";
  dot?: "danger";
}

const platformItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3"/><rect width="7" height="5" x="14" y="3"/><rect width="7" height="9" x="14" y="12"/><rect width="7" height="5" x="3" y="16"/></svg>,
  },
  {
    label: "Sites",
    href: "/sites",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>,
    badge: 18,
    badgeTone: "muted",
  },
  {
    label: "Updates",
    href: "/updates",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/></svg>,
    badge: 9,
    badgeTone: "primary",
  },
  {
    label: "Monitoring",
    href: "/monitoring",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    dot: "danger",
  },
  {
    label: "Traffic",
    href: "/traffic",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>,
  },
  {
    label: "Audit log",
    href: "/audit-log",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>,
  },
];

const accountItems: NavItem[] = [
  {
    label: "Settings",
    href: "/settings",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg>,
  },
  {
    label: "Account",
    href: "/account",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.66V19a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1.66"/></svg>,
  },
];

function NavItemRow({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-[11px] px-[11px] py-[9px] text-[13.5px] transition-colors duration-100",
        isActive
          ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-foreground)] shadow-[inset_3px_0_0_var(--primary)] font-semibold"
          : "text-[var(--muted-foreground)] hover:text-[var(--sidebar-foreground)] font-medium"
      )}
    >
      <span className="flex-none">{item.icon}</span>
      <span className="flex-1 whitespace-nowrap">{item.label}</span>
      {item.badge !== undefined && (
        <span
          className={cn(
            "text-[11px] font-semibold px-[6px] py-[1px]",
            item.badgeTone === "primary"
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "bg-[var(--muted)] text-[var(--muted-foreground)]"
          )}
        >
          {item.badge}
        </span>
      )}
      {item.dot && (
        <span className="w-[7px] h-[7px] flex-none rounded-full bg-[var(--danger)]" />
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/sites") return pathname === "/sites" || pathname.startsWith("/sites/");
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-[248px] flex-none bg-[var(--sidebar)] border-r border-[var(--sidebar-border)] flex flex-col">
      {/* Brand */}
      <div className="h-[60px] flex-none flex items-center gap-[11px] px-[18px] border-b border-[var(--sidebar-border)]">
        <span className="w-[30px] h-[30px] flex-none bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="8" x="2" y="2"/><rect width="20" height="8" x="2" y="14"/><path d="M6 6h.01"/><path d="M6 18h.01"/></svg>
        </span>
        <span className="font-heading font-bold text-[16px] tracking-tight text-[var(--sidebar-foreground)] whitespace-nowrap">
          WP Control
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-[12px] py-[16px] flex flex-col gap-[3px] overflow-y-auto">
        <div className="font-heading text-[10.5px] font-semibold tracking-[0.1em] uppercase text-[var(--muted-foreground)] px-[11px] pb-[8px]">
          Platform
        </div>
        {platformItems.map((item) => (
          <NavItemRow key={item.href} item={item} isActive={isActive(item.href)} />
        ))}

        <div className="font-heading text-[10.5px] font-semibold tracking-[0.1em] uppercase text-[var(--muted-foreground)] px-[11px] pt-[18px] pb-[8px]">
          Account
        </div>
        {accountItems.map((item) => (
          <NavItemRow key={item.href} item={item} isActive={isActive(item.href)} />
        ))}
      </nav>

      {/* User */}
      <div className="flex-none border-t border-[var(--sidebar-border)] px-[14px] py-[12px] flex items-center gap-[10px]">
        <span className="w-[32px] h-[32px] flex-none rounded-full bg-[var(--muted)] text-[var(--foreground)] flex items-center justify-center text-[12px] font-semibold">
          AD
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[var(--sidebar-foreground)] truncate">
            Admin
          </div>
          <div className="text-[11.5px] text-[var(--muted-foreground)]">
            SUPER_ADMIN
          </div>
        </div>
        <span className="text-[var(--muted-foreground)] flex">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </span>
      </div>
    </aside>
  );
}
