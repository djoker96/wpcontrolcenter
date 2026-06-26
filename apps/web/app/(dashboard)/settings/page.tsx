"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

interface NotificationChannel {
  id: string;
  channelType: string;
  destination: string;
  isEnabled: boolean;
  createdAt: string;
}

type SettingsTab = "notifications" | "general" | "security";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("notifications");
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);

  // New channel form
  const [channelType, setChannelType] = useState("SLACK");
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchChannels = useCallback(async () => {
    try {
      const data = await api.get<{ data: NotificationChannel[] }>("/notifications/channels");
      setChannels(data.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "notifications") Promise.resolve().then(() => fetchChannels());
  }, [activeTab, fetchChannels]);

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/notifications/channels", { channelType, destination, isEnabled: true });
      setDestination("");
      await fetchChannels();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add channel");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveChannel = async (id: string) => {
    if (!confirm("Delete this notification channel?")) return;
    try {
      await api.delete(`/notifications/channels/${id}`);
      await fetchChannels();
    } catch {
      alert("Failed to delete channel");
    }
  };

  const channelBadge = (type: string) => {
    switch (type) {
      case "SLACK": return "warning" as const;
      case "DISCORD": return "neutral" as const;
      case "TELEGRAM": return "neutral" as const;
      case "EMAIL": return "success" as const;
      default: return "neutral" as const;
    }
  };

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "notifications", label: "Notifications" },
    { id: "general", label: "General" },
    { id: "security", label: "Security" },
  ];

  return (
    <>
      <Header title="Settings" subtitle="Configure system preferences" />
      <main className="wpcc-scroll flex-1 overflow-auto bg-[var(--muted)] p-[24px]">
        <div className="max-w-[960px] mx-auto">
          {/* Tabs */}
          <div className="flex gap-[20px] border-b border-[var(--border)] mb-[24px]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-[12px] text-[13.5px] font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-[var(--primary)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="flex flex-col gap-[24px]">
              {/* Add Channel Form */}
              <div className="bg-[var(--card)] border border-[var(--border)] p-[24px]">
                <h3 className="font-heading font-semibold text-[16px] mb-[16px]">Add Alert Channel</h3>
                <form onSubmit={handleAddChannel} className="flex flex-col gap-[16px]">
                  <div className="grid grid-cols-2 gap-[16px]">
                    <div className="flex flex-col gap-[6px]">
                      <label className="text-[12px] font-semibold text-[var(--muted-foreground)]">Channel Type</label>
                      <select
                        value={channelType}
                        onChange={(e) => setChannelType(e.target.value)}
                        className="h-[40px] px-[12px] border border-[var(--input)] bg-[var(--background)] text-[13.5px] outline-none"
                      >
                        <option value="SLACK">Slack Webhook</option>
                        <option value="DISCORD">Discord Webhook</option>
                        <option value="TELEGRAM">Telegram Bot</option>
                        <option value="EMAIL">Email Address</option>
                        <option value="WEBHOOK">Custom HTTP Webhook</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-[6px]">
                      <label className="text-[12px] font-semibold text-[var(--muted-foreground)]">Destination</label>
                      <input
                        type="text"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="https://hooks.slack.com/..."
                        className="h-[40px] px-[12px] border border-[var(--input)] bg-[var(--background)] text-[13.5px] outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={submitting || !destination}>
                      {submitting ? "Adding..." : "Add Channel"}
                    </Button>
                  </div>
                </form>
              </div>

              {/* Channels List */}
              <div className="bg-[var(--card)] border border-[var(--border)]">
                <div className="px-[20px] py-[14px] border-b border-[var(--border)]">
                  <h3 className="font-heading font-semibold text-[16px]">Active Channels</h3>
                </div>
                {loading ? (
                  <div className="p-[20px] text-[13px] text-[var(--muted-foreground)]">Loading...</div>
                ) : channels.length === 0 ? (
                  <div className="p-[20px] text-[13px] text-[var(--muted-foreground)]">No channels configured.</div>
                ) : (
                  channels.map((ch) => (
                    <div key={ch.id} className="flex items-center justify-between px-[20px] py-[14px] border-b border-[var(--border)] last:border-0">
                      <div className="flex items-center gap-[12px]">
                        <Badge tone={channelBadge(ch.channelType)}>{ch.channelType}</Badge>
                        <span className="text-[13px] font-mono text-[var(--foreground)]">{ch.destination}</span>
                      </div>
                      <div className="flex items-center gap-[12px]">
                        <Switch
                          checked={ch.isEnabled}
                          onChange={() => {}}
                        />
                        <button
                          onClick={() => handleRemoveChannel(ch.id)}
                          className="text-[12px] text-[var(--danger)] hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* General Tab */}
          {activeTab === "general" && (
            <div className="bg-[var(--card)] border border-[var(--border)] p-[24px] flex flex-col gap-[20px]">
              <div className="flex flex-col gap-[6px]">
                <label className="text-[12px] font-semibold text-[var(--muted-foreground)]">System Name</label>
                <input type="text" defaultValue="WP Control Center" className="h-[40px] px-[12px] border border-[var(--input)] bg-[var(--background)] text-[13.5px] outline-none max-w-[400px]" />
              </div>
              <div className="flex flex-col gap-[6px]">
                <label className="text-[12px] font-semibold text-[var(--muted-foreground)]">API URL</label>
                <input type="text" defaultValue="http://localhost:3003/api" className="h-[40px] px-[12px] border border-[var(--input)] bg-[var(--background)] text-[13.5px] font-mono outline-none max-w-[400px]" readOnly />
              </div>
              <div className="flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="flex flex-col gap-[24px]">
              <div className="bg-[var(--card)] border border-[var(--border)] p-[24px] flex flex-col gap-[20px]">
                <h3 className="font-heading font-semibold text-[16px]">Session Security</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-medium">Session Timeout</div>
                    <div className="text-[12px] text-[var(--muted-foreground)]">Automatically log out inactive users</div>
                  </div>
                  <select className="h-[36px] px-[10px] border border-[var(--input)] bg-[var(--background)] text-[13px] outline-none">
                    <option>1 hour</option>
                    <option>4 hours</option>
                    <option>8 hours</option>
                    <option>24 hours</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-medium">Two-Factor Authentication</div>
                    <div className="text-[12px] text-[var(--muted-foreground)]">Require 2FA for all admin users</div>
                  </div>
                  <Switch checked={false} onChange={() => {}} />
                </div>
              </div>

              <div className="bg-[var(--card)] border border-[var(--border)] p-[24px]">
                <h3 className="font-heading font-semibold text-[16px] mb-[16px]">Integrations</h3>
                <p className="text-[13px] text-[var(--muted-foreground)] mb-[12px]">
                  Manage connected services like Google Analytics and Search Console.
                </p>
                <Link
                  href="/settings/integrations"
                  className="inline-flex items-center gap-[6px] h-[36px] px-[14px] border border-[var(--border)] text-[13px] font-semibold hover:bg-[var(--accent)]"
                >
                  Manage Integrations
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
