"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { API_URL, apiFetch } from "@/lib/api";

interface NotificationChannel {
  id: string;
  channelType: 'EMAIL' | 'TELEGRAM' | 'SLACK' | 'DISCORD' | 'WEBHOOK';
  destination: string;
  isEnabled: boolean;
  createdAt: string;
}

interface NotificationEvent {
  id: string;
  eventType: string;
  channelType: string;
  destination: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  sentAt: string | null;
  createdAt: string;
  payloadJson?: Record<string, unknown> | null;
  site?: { name: string; domain: string } | null;
  incident?: { incidentType: string; severity: string; status: string } | null;
}

function NotificationsContent() {
  const router = useRouter();
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Form State
  const [channelType, setChannelType] = useState<'EMAIL' | 'TELEGRAM' | 'SLACK' | 'DISCORD' | 'WEBHOOK'>('SLACK');
  const [destination, setDestination] = useState("");

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("wpcc_token");
    if (!token) {
      router.push("/");
      return;
    }

    try {
      setLoading(true);
      setError("");
      
      // Fetch Channels
      const channelsRes = await apiFetch(`${API_URL}/notifications/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!channelsRes.ok) throw new Error("Failed to load notification channels");
      const channelsJson = await channelsRes.json();
      setChannels(channelsJson.data || []);

      // Fetch Events Log
      const eventsRes = await apiFetch(`${API_URL}/notifications/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (eventsRes.ok) {
        const eventsJson = await eventsRes.json();
        setEvents(eventsJson.data || []);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("wpcc_token");
    if (!token || !destination) return;

    setSubmitting(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await apiFetch(`${API_URL}/notifications/channels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          channelType,
          destination,
          isEnabled: true,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || "Failed to create channel");
      }

      setSuccessMsg("Notification channel added successfully!");
      setDestination("");
      await fetchData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to create channel";
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveChannel = async (id: string) => {
    const token = localStorage.getItem("wpcc_token");
    if (!token) return;

    if (!confirm("Are you sure you want to delete this notification channel?")) return;

    setError("");
    setSuccessMsg("");

    try {
      const res = await apiFetch(`${API_URL}/notifications/channels/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to delete channel");
      setSuccessMsg("Channel removed.");
      await fetchData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete channel";
      setError(errorMsg);
    }
  };

  return (
    <div className="min-h-svh bg-zinc-950 text-zinc-100 font-sans p-6">
      <main className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <Link href="/sites" className="text-zinc-500 hover:text-white text-sm flex items-center gap-1.5 transition">
            ← Back to Sites
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-heading mt-2">
            Notification Settings
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Configure destinations for website downtime alerts and recovery notifications.
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="rounded-lg border border-red-900/30 bg-red-950/20 p-4 text-sm text-red-400 animate-in fade-in">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="rounded-lg border border-emerald-900/30 bg-emerald-950/20 p-4 text-sm text-emerald-400 animate-in fade-in">
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel: Create Channel Form */}
          <div className="lg:col-span-1 rounded-xl border border-zinc-900 bg-zinc-900/10 p-6 backdrop-blur-md space-y-4">
            <h3 className="text-lg font-bold text-white font-heading">Add Alert Channel</h3>
            
            <form onSubmit={handleAddChannel} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-semibold">Channel Type</label>
                <select
                  value={channelType}
                  onChange={(e) => setChannelType(e.target.value as NotificationChannel['channelType'])}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 p-2.5 text-sm text-white outline-none focus:border-violet-500 transition"
                >
                  <option value="SLACK">Slack Webhook</option>
                  <option value="DISCORD">Discord Webhook</option>
                  <option value="TELEGRAM">Telegram Bot</option>
                  <option value="EMAIL">Email Address</option>
                  <option value="WEBHOOK">Custom HTTP Webhook</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-semibold">Destination / Target URL</label>
                <textarea
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder={
                    channelType === 'EMAIL' ? "e.g. ops@example.com" :
                    channelType === 'TELEGRAM' ? "botToken:chatId (e.g. 123456:78910)" :
                    "e.g. https://hooks.slack.com/services/..."
                  }
                  rows={3}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 p-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500 transition font-mono"
                  required
                />
                <p className="text-[10px] text-zinc-500">
                  {channelType === 'TELEGRAM' && "Format: Dán token của Telegram Bot và Chat ID phân tách bởi dấu hai chấm."}
                  {channelType === 'SLACK' && "Webhook URL của ứng dụng Slack Incoming Webhooks."}
                  {channelType === 'DISCORD' && "Discord Server Webhook URL."}
                  {channelType === 'EMAIL' && "Địa chỉ Email sẽ nhận các email cảnh báo mô phỏng."}
                  {channelType === 'WEBHOOK' && "Địa chỉ URL của HTTP Server sẽ nhận POST payload JSON."}
                </p>
              </div>

              <Button
                type="submit"
                disabled={submitting || !destination}
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold py-2.5"
              >
                {submitting ? "Adding..." : "Add Channel"}
              </Button>
            </form>
          </div>

          {/* Right Panel: Channels list */}
          <div className="lg:col-span-2 rounded-xl border border-zinc-900 bg-zinc-900/10 p-6 backdrop-blur-md space-y-4">
            <h3 className="text-lg font-bold text-white font-heading">Active Channels</h3>
            
            {loading && channels.length === 0 ? (
              <div className="text-zinc-500 text-sm">Loading active channels...</div>
            ) : channels.length === 0 ? (
              <div className="text-zinc-500 text-sm italic py-4">No alert channels configured yet. Incidents will only be logged in DB.</div>
            ) : (
              <div className="divide-y divide-zinc-900">
                {channels.map((channel) => (
                  <div key={channel.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold ${
                          channel.channelType === 'SLACK' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30' :
                          channel.channelType === 'DISCORD' ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/30' :
                          channel.channelType === 'TELEGRAM' ? 'bg-sky-950/40 text-sky-400 border border-sky-900/30' :
                          'bg-zinc-800 text-zinc-300'
                        }`}>
                          {channel.channelType}
                        </span>
                        <span className={`h-1.5 w-1.5 rounded-full ${channel.isEnabled ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                        <span className="text-xs text-zinc-500">{channel.isEnabled ? "Active" : "Disabled"}</span>
                      </div>
                      <div className="text-sm font-mono text-zinc-300 break-all">{channel.destination}</div>
                    </div>

                    <button
                      onClick={() => handleRemoveChannel(channel.id)}
                      className="text-xs text-red-400 hover:text-red-300 font-semibold px-2.5 py-1.5 rounded border border-red-950/50 hover:bg-red-950/20 transition"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* History Delivery Logs Table */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6 backdrop-blur-md space-y-4">
          <h3 className="text-lg font-bold text-white font-heading">Recent Alert Delivery Logs</h3>
          
          {loading && events.length === 0 ? (
            <div className="text-zinc-500 text-sm">Loading delivery logs...</div>
          ) : events.length === 0 ? (
            <div className="text-zinc-600 text-sm italic py-4 text-center">No alerts have been dispatched yet.</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/10">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-900 bg-zinc-900/40 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    <th className="p-4">Site</th>
                    <th className="p-4">Event</th>
                    <th className="p-4">Channel</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Recipient/Destination</th>
                    <th className="p-4">Dispatched At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {events.map((event) => (
                    <tr key={event.id} className="hover:bg-zinc-900/20 transition">
                      <td className="p-4">
                        <div className="font-semibold text-white">{event.site?.name || "Global / System"}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">{event.site?.domain || "—"}</div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          event.eventType === 'INCIDENT_OPENED'
                            ? 'bg-red-950/40 text-red-400 border border-red-900/30'
                            : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30'
                        }`}>
                          {event.eventType === 'INCIDENT_OPENED' ? 'Incident Down' : 'Incident Resolved'}
                        </span>
                      </td>
                      <td className="p-4 text-zinc-300 font-mono text-xs">{event.channelType}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          event.status === 'SENT' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' :
                          event.status === 'FAILED' ? 'bg-red-950/40 text-red-400 border border-red-900/30' :
                          'bg-zinc-850 text-zinc-400 border border-zinc-800'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            event.status === 'SENT' ? 'bg-emerald-500' :
                            event.status === 'FAILED' ? 'bg-red-500' :
                            'bg-zinc-500'
                          }`} />
                          {event.status}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-zinc-400 text-xs truncate max-w-xs select-all" title={event.destination}>
                        {event.destination}
                      </td>
                      <td className="p-4 text-zinc-500 text-xs">
                        {new Date(event.sentAt || event.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-svh items-center justify-center bg-zinc-950 text-zinc-200">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    }>
      <NotificationsContent />
    </Suspense>
  );
}
