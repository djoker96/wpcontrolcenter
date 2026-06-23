"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { api } from "@/lib/api-client";
import { UploadUpdateDrawer } from "@/components/updates/UploadUpdateDrawer";

interface UpdateItem {
  id: string;
  site: string;
  siteId?: string;
  type: string;
  item: string;
  cur: string;
  avail: string;
  slug?: string;
  sel: boolean;
}

interface SiteGroup {
  siteName: string;
  siteId: string;
  updates: UpdateItem[];
}

const MOCK_UPDATES: UpdateItem[] = [
  { id: "1", site: "bluewave.io", siteId: "s1", type: "Core", item: "WordPress", cur: "6.4.3", avail: "6.5.2", sel: false },
  { id: "2", site: "bluewave.io", siteId: "s1", type: "Plugin", item: "Yoast SEO", cur: "22.1", avail: "22.4", slug: "wordpress-seo", sel: false },
  { id: "3", site: "acme-corp.com", siteId: "s2", type: "Plugin", item: "WP Rocket", cur: "3.15", avail: "3.16", slug: "wp-rocket", sel: false },
  { id: "4", site: "acme-corp.com", siteId: "s2", type: "Theme", item: "Astra", cur: "4.6.0", avail: "4.6.4", slug: "astra", sel: false },
  { id: "5", site: "lotus-clinic.vn", siteId: "s3", type: "Plugin", item: "Contact Form 7", cur: "5.8", avail: "5.9.2", slug: "contact-form-7", sel: false },
  { id: "6", site: "shop.northstar.co", siteId: "s4", type: "Plugin", item: "WooCommerce", cur: "8.5", avail: "8.6.1", slug: "woocommerce", sel: false },
  { id: "7", site: "nordic-travel.no", siteId: "s5", type: "Plugin", item: "Elementor", cur: "3.20", avail: "3.21", slug: "elementor", sel: false },
  { id: "8", site: "nordic-travel.no", siteId: "s5", type: "Plugin", item: "WPML", cur: "4.6", avail: "4.6.7", slug: "wpml", sel: false },
  { id: "9", site: "dev.bluewave.io", siteId: "s6", type: "Plugin", item: "ACF", cur: "6.2", avail: "6.3", slug: "advanced-custom-fields", sel: false },
];

/* ── helpers ── */
const TYPE_ORDER: Record<string, number> = { Core: 0, Theme: 1, Plugin: 2 };

function typeIcon(type: string) {
  switch (type) {
    case "Core":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
        </svg>
      );
    case "Theme":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
      );
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><path d="M3 9h18" /><path d="M9 21V9" />
        </svg>
      );
  }
}

function typeBadge(type: string) {
  const styles: Record<string, string> = {
    Core: "bg-[var(--danger)]/10 text-[var(--danger)]",
    Theme: "bg-[var(--warning)]/10 text-[var(--warning)]",
    Plugin: "bg-[var(--info)]/10 text-[var(--info)]",
  };
  return (
    <span className={`text-[10px] font-semibold tracking-[0.04em] uppercase px-[8px] py-[2px] ${styles[type] || "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>
      {type}
    </span>
  );
}

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<UpdateItem[]>(MOCK_UPDATES);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [uploadDrawerSite, setUploadDrawerSite] = useState<{
    id: string; name: string;
    presetType?: "plugin" | "theme";
    presetSlug?: string;
  } | null>(null);

  const selected = updates.filter((u) => u.sel);

  /* Group by site, then sort by type */
  const siteGroups = useMemo<SiteGroup[]>(() => {
    const map = new Map<string, UpdateItem[]>();
    for (const u of updates) {
      const list = map.get(u.site);
      if (list) list.push(u);
      else map.set(u.site, [u]);
    }
    return Array.from(map.entries())
      .map(([siteName, items]) => ({
        siteName,
        siteId: items.find((i) => i.siteId)?.siteId || "",
        updates: items.sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9)),
      }));
  }, [updates]);

  const toggleItem = (id: string) => {
    setUpdates((prev) => prev.map((u) => (u.id === id ? { ...u, sel: !u.sel } : u)));
  };

  const toggleSite = (siteName: string, allSelected: boolean) => {
    setUpdates((prev) => prev.map((u) => (u.site === siteName ? { ...u, sel: !allSelected } : u)));
  };

  const clearSelection = () => {
    setUpdates((prev) => prev.map((u) => ({ ...u, sel: false })));
  };

  const updateItem = async (u: UpdateItem) => {
    const action = u.type === "Core" ? "update-core" : u.type === "Plugin" ? "update-plugin" : "update-theme";
    const body: Record<string, string> = {};
    if (u.slug) body.slug = u.slug;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const siteId = u.siteId || (u as any)._siteId || "";
      if (!siteId) { alert(`No site ID for ${u.site} — mock mode`); return; }
      await api.post(`/sites/${siteId}/actions/${action}`, body);
      alert(`Update queued for ${u.item} on ${u.site}`);
    } catch {
      alert(`Update queued for ${u.item} on ${u.site} (API pending — mock mode)`);
    }
  };

  const updateSelected = async () => {
    for (const u of selected) {
      await updateItem(u);
    }
    clearSelection();
  };

  return (
    <>
      <Header
        title="Updates"
        subtitle={`${updates.length} pending across ${siteGroups.length} sites`}
      >
        <div className="flex items-center gap-[8px] h-[36px] px-[12px] border border-[var(--border)] bg-[var(--background)] text-[13px] font-medium">
          Type: All
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-foreground)]"><path d="m6 9 6 6 6-6"/></svg>
        </div>

        {/* Grid / List toggle */}
        <div className="flex border border-[var(--border)] overflow-hidden">
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center justify-center w-[36px] h-[36px] transition-colors ${
              viewMode === "grid"
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
            title="Grid view — 2 columns"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center justify-center w-[36px] h-[36px] transition-colors ${
              viewMode === "list"
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
            title="List view — stacked"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="18" y2="18"/>
            </svg>
          </button>
        </div>

        <button
          onClick={updateSelected}
          disabled={selected.length === 0}
          className={`inline-flex items-center gap-[7px] h-[36px] px-[15px] font-semibold text-[13.5px] ${
            selected.length > 0
              ? "bg-[var(--primary)] text-[var(--primary-foreground)] cursor-pointer hover:opacity-90"
              : "bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/></svg>
          Update {selected.length} selected
        </button>

        {/* Bulk upload link */}
        <Link
          href="/updates/upload"
          className="inline-flex items-center gap-[7px] h-[36px] px-[15px] border border-[var(--border)] font-semibold text-[13.5px] hover:bg-[var(--accent)]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
          </svg>
          Bulk upload
        </Link>
      </Header>

      <main className="wpcc-scroll flex-1 overflow-auto bg-[var(--muted)] p-[24px]">
        {/* Bulk bar */}
        {selected.length > 0 && (
          <div className="flex items-center gap-[16px] mb-[16px] px-[18px] py-[11px] bg-[color-mix(in_oklch,var(--primary)_16%,white)] border border-[var(--border)]">
            <span className="text-[13px] font-semibold">{selected.length} selected</span>
            <button onClick={updateSelected} className="inline-flex items-center gap-[6px] text-[12.5px] font-medium cursor-pointer hover:opacity-80">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/></svg>
              Update selected
            </button>
            <span className="flex-1" />
            <button onClick={clearSelection} className="text-[12.5px] font-medium text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)]">
              Clear selection
            </button>
          </div>
        )}

        {/* Site cards — grid (default) or list */}
        <div className={viewMode === "grid" ? "grid grid-cols-2 gap-[16px]" : "flex flex-col gap-[16px]"}>
          {siteGroups.map((group, idx) => (
            <div
              key={group.siteName}
              className={
                "bg-[var(--card)] border border-[var(--border)]" +
                (viewMode === "grid" && siteGroups.length % 2 !== 0 && idx === siteGroups.length - 1
                  ? " col-span-full"
                  : "")
              }
            >
              {/* Card header — site name */}
              <div className="flex items-center justify-between px-[20px] py-[14px] border-b border-[var(--border)]">
                <div className="flex items-center gap-[9px]">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-foreground)]">
                    <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  <h3 className="font-heading font-semibold text-[15px]">{group.siteName}</h3>
                </div>
                <span className="text-[11.5px] font-medium text-[var(--muted-foreground)]">{group.updates.length} update{group.updates.length > 1 ? "s" : ""}</span>
              </div>

              {/* Column headers */}
              {(() => {
                const siteAllSel = group.updates.every((u) => u.sel);
                const siteSomeSel = group.updates.some((u) => u.sel);
                return (
                  <div className="grid grid-cols-[36px_70px_1fr_1fr_160px] gap-[14px] items-center px-[20px] py-[8px] border-b border-[var(--border)] font-heading text-[10.5px] font-semibold tracking-[0.04em] uppercase text-[var(--muted-foreground)]">
                    <button
                      onClick={() => toggleSite(group.siteName, siteAllSel)}
                      className="w-[16px] h-[16px] border-[1.5px] flex items-center justify-center"
                    >
                      {siteAllSel ? (
                        <span className="w-full h-full bg-[var(--primary)] flex items-center justify-center text-[11px] font-bold text-[var(--primary-foreground)]">✓</span>
                      ) : siteSomeSel ? (
                        <span className="w-[8px] h-[2px] bg-[var(--ring)]" />
                      ) : null}
                    </button>
                    <span>Type</span>
                    <span>Item</span>
                    <span>Version</span>
                    <span className="text-right">Action</span>
                  </div>
                );
              })()}

              {/* Items */}
              <div className="divide-y divide-[var(--border)]">
                {group.updates.map((u) => {
                  const updType = u.type === "Core" ? "plugin" as const : u.type === "Theme" ? "theme" as const : "plugin" as const;
                  const updSlug = u.type === "Plugin" ? (u.slug ?? u.item.toLowerCase().replace(/\s+/g, "-")) : undefined;
                  return (
                    <div
                      key={u.id}
                      className="grid grid-cols-[36px_70px_1fr_1fr_160px] gap-[14px] items-center px-[20px] py-[11px] hover:bg-[var(--accent)] transition-colors"
                    >
                      <button onClick={() => toggleItem(u.id)} className="w-[16px] h-[16px] flex-none">
                        <span
                          className={`w-full h-full border-[1.5px] flex items-center justify-center text-[var(--primary-foreground)] text-[11px] font-bold ${
                            u.sel ? "bg-[var(--primary)] border-[var(--primary)]" : "border-[var(--ring)] bg-transparent"
                          }`}
                        >
                          {u.sel ? "✓" : ""}
                        </span>
                      </button>
                      <div className="flex items-center gap-[6px]">
                        <span className="text-[var(--muted-foreground)] shrink-0">{typeIcon(u.type)}</span>
                        {typeBadge(u.type)}
                      </div>
                      <span className="text-[13px] font-semibold">{u.item}</span>
                      <span className="text-[12.5px] text-[var(--muted-foreground)]">
                        {u.cur} <span className="text-[var(--muted-foreground)]">→</span>{" "}
                        <span className="text-[var(--foreground)] font-semibold">{u.avail}</span>
                      </span>
                      <span className="justify-self-end flex gap-[4px]">
                        <button
                          onClick={() => updateItem(u)}
                          className="inline-flex items-center justify-center h-[28px] px-[10px] border border-[var(--border)] font-semibold text-[11.5px] cursor-pointer hover:bg-[var(--accent)]"
                        >
                          Update
                        </button>
                        {u.type !== "Core" && (
                          <button
                            onClick={() => setUploadDrawerSite({
                              id: group.siteId,
                              name: group.siteName,
                              presetType: updType,
                              presetSlug: updSlug,
                            })}
                            title="Upload .zip manually"
                            className="inline-flex items-center justify-center h-[28px] px-[10px] border border-[var(--border)] font-semibold text-[11.5px] cursor-pointer hover:bg-[var(--accent)]"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
                            </svg>
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-[9px] mt-[16px] px-[18px] py-[12px] bg-[var(--card)] border border-[var(--border)] text-[12.5px] text-[var(--muted-foreground)]">
          <span className="flex text-[var(--warning)]"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></span>
          Updates run as queued jobs with retry on failure — results land in the audit log.
        </div>
      </main>

      {/* Upload drawer */}
      {uploadDrawerSite && (
        <UploadUpdateDrawer
          open={!!uploadDrawerSite}
          onClose={() => setUploadDrawerSite(null)}
          siteId={uploadDrawerSite.id}
          siteName={uploadDrawerSite.name}
          presetType={uploadDrawerSite.presetType}
          presetSlug={uploadDrawerSite.presetSlug}
        />
      )}
    </>
  );
}
