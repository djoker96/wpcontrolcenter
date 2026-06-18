# WP Control Center - Phase E: Uptime & Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a real-time website monitoring and uptime checking engine that automatically pings connected WordPress sites, logs latency/HTTP codes, manages system-wide incidents (auto-open/auto-resolve), and visualizes history on the frontend dashboard.

**Architecture:**
1. **Worker Uptime Engine (`apps/worker`)**: Runs a persistent monitoring loop using settings from database. Pings websites via fetch, measures response time, logs records to `UptimeCheck` table, detects failures, and auto-manages incidents using consecutive failure thresholds.
2. **Backend Monitoring Services (`apps/api`)**: Replaces stubs in `MonitoringController` and `SitesController` with database-driven queries. Computes uptime ratios (last 24 hours), fetches unresolved incidents, and returns check history.
3. **Frontend Uptime Dashboard (`apps/web`)**: Integrates an "Uptime & Incidents" tab inside the website detail view. Renders historical latency, uptime percentages, and status alerts.

**Tech Stack:** NestJS, BullMQ (optional scheduler / direct interval loop), Prisma, Next.js, Node.js Fetch, CSS.

## Global Constraints
- Uptime checker must run in the background worker.
- Interval must be configurable via `UPTIME_CHECK_INTERVAL_SECONDS` (default: 300 seconds).
- Use database transactions or optimized query checks where appropriate.
- Avoid hardcoded values, pull secrets/urls from config.

---

### Task 1: Background Uptime Checker Worker Engine

**Files:**
- Modify: [apps/worker/src/index.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/worker/src/index.ts)

**Interfaces:**
- Consumes: `process.env.UPTIME_CHECK_INTERVAL_SECONDS`. Query sites with `uptimeCheckEnabled = true`.
- Produces: Write `UptimeCheck` and `Incident` records to database.

- [ ] **Step 1: Implement Uptime check core function in Worker**
  Modify [index.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/worker/src/index.ts) to define a robust `runUptimeChecks()` method. It queries all sites with uptime checking enabled, pings them, saves status/latency, and checks consecutive failures (threshold: 3 consecutive failures to trigger a new Incident). It also auto-resolves any open incidents when the site is up again.

  Replace:
  ```typescript
  // Keep existing mocks ticking for background compatibility
  function tick(name: string): void {
    console.log(`[worker] ${name} tick at ${new Date().toISOString()}`);
  }

  setInterval(() => tick('uptime-check'), 5 * 60 * 1000);
  setInterval(() => tick('analytics-sync'), 60 * 60 * 1000);
  setInterval(() => tick('dispatch-jobs'), 15 * 1000);
  ```
  With the real implementation:
  ```typescript
  async function runUptimeChecks() {
    console.log(`[worker] Starting uptime checks at ${new Date().toISOString()}`);
    try {
      const sites = await prisma.site.findMany({
        where: {
          status: 'ACTIVE',
          setting: {
            uptimeCheckEnabled: true,
          },
        },
        include: {
          setting: true,
        },
      });

      for (const site of sites) {
        let isUp = false;
        let responseTimeMs = 0;
        let statusCode: number | null = null;
        let errorMessage: string | null = null;

        const start = performance.now();
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

          const response = await fetch(site.siteUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'WP-Control-Center-Monitor/1.0',
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          responseTimeMs = Math.round(performance.now() - start);
          statusCode = response.status;
          isUp = response.status < 400;
          if (!isUp) {
            errorMessage = `HTTP Status Code ${response.status}`;
          }
        } catch (err: any) {
          responseTimeMs = Math.round(performance.now() - start);
          isUp = false;
          errorMessage = err.message || 'Network Timeout / Connection Error';
        }

        // Save check log
        await prisma.uptimeCheck.create({
          data: {
            siteId: site.id,
            statusCode,
            responseTimeMs,
            isUp,
            errorMessage,
          },
        });

        if (isUp) {
          // If site is UP, check if there's any OPEN incident and auto-resolve it
          const openIncidents = await prisma.incident.findMany({
            where: {
              siteId: site.id,
              status: 'OPEN',
              incidentType: 'UPTIME',
            },
          });

          if (openIncidents.length > 0) {
            console.log(`[worker] Site ${site.domain} is BACK UP. Resolving ${openIncidents.length} incidents.`);
            await prisma.incident.updateMany({
              where: {
                siteId: site.id,
                status: 'OPEN',
                incidentType: 'UPTIME',
              },
              data: {
                status: 'RESOLVED',
                endedAt: new Date(),
                summary: 'Website is back up and responding normally.',
              },
            });
          }
        } else {
          // If site is DOWN, fetch last 3 checks to verify consecutive failure threshold
          const lastChecks = await prisma.uptimeCheck.findMany({
            where: { siteId: site.id },
            orderBy: { checkedAt: 'desc' },
            take: 3,
          });

          const consecutiveFailures = lastChecks.filter(c => !c.isUp).length;
          if (consecutiveFailures >= 3) {
            // Check if there is already an open incident
            const activeIncident = await prisma.incident.findFirst({
              where: {
                siteId: site.id,
                status: 'OPEN',
                incidentType: 'UPTIME',
              },
            });

            if (!activeIncident) {
              console.log(`[worker] Site ${site.domain} down for 3 consecutive checks. Opening INCIDENT.`);
              await prisma.incident.create({
                data: {
                  siteId: site.id,
                  incidentType: 'UPTIME',
                  severity: 'CRITICAL',
                  startedAt: new Date(),
                  status: 'OPEN',
                  summary: `Website is offline. Error: ${errorMessage}`,
                  metadataJson: {
                    lastStatusCode: statusCode,
                    consecutiveFailures,
                  },
                },
              });
            }
          }
        }
      }
    } catch (error: any) {
      console.error('[worker] Error running uptime checks:', error);
    }
  }

  const intervalSeconds = process.env.UPTIME_CHECK_INTERVAL_SECONDS ? Number(process.env.UPTIME_CHECK_INTERVAL_SECONDS) : 300;
  console.log(`[worker] Uptime check interval configured to ${intervalSeconds}s`);

  // Start periodic checks
  setInterval(() => runUptimeChecks(), intervalSeconds * 1000);
  
  // Run once immediately on start
  Promise.resolve().then(() => runUptimeChecks());

  // Keep existing mocks ticking for background compatibility
  function tick(name: string): void {
    console.log(`[worker] ${name} tick at ${new Date().toISOString()}`);
  }

  setInterval(() => tick('analytics-sync'), 60 * 60 * 1000);
  setInterval(() => tick('dispatch-jobs'), 15 * 1000);
  ```

- [ ] **Step 2: Commit Worker changes**
  Run:
  ```bash
  git add apps/worker/src/index.ts
  git commit -m "feat: implement real-time background uptime checker and incident manager in worker"
  ```

---

### Task 2: Backend API Integration for Monitoring & Sites

**Files:**
- Modify: `apps/api/src/modules/monitoring/monitoring.service.ts`
- Modify: `apps/api/src/modules/monitoring/monitoring.controller.ts`
- Modify: `apps/api/src/modules/sites/sites.controller.ts`
- Modify: `apps/api/src/modules/sites/sites.service.ts`

**Interfaces:**
- Consumes: Database query operations on `UptimeCheck` and `Incident`.
- Produces: Structured JSON responses for Uptime checks, current incidents, and aggregate monitoring status.

- [ ] **Step 1: Update MonitoringService**
  Modify [monitoring.service.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/modules/monitoring/monitoring.service.ts) to query the database.
  Replace:
  ```typescript
  import { Injectable } from '@nestjs/common';

  @Injectable()
  export class MonitoringService {
    overview() { return { totalSites: 1, downSites: 0, activeIncidents: 0 }; }
  }
  ```
  With:
  ```typescript
  import { Injectable } from '@nestjs/common';
  import { PrismaService } from '../database/prisma.service';

  @Injectable()
  export class MonitoringService {
    constructor(private readonly prisma: PrismaService) {}

    async overview() {
      const totalSites = await this.prisma.site.count({ where: { status: 'ACTIVE' } });
      const activeIncidents = await this.prisma.incident.count({ where: { status: 'OPEN' } });

      // Group checks by siteId, take latest check for each site to see if it is down
      const sites = await this.prisma.site.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });

      let downSites = 0;
      for (const site of sites) {
        const lastCheck = await this.prisma.uptimeCheck.findFirst({
          where: { siteId: site.id },
          orderBy: { checkedAt: 'desc' },
        });
        if (lastCheck && !lastCheck.isUp) {
          downSites++;
        }
      }

      return {
        totalSites,
        downSites,
        activeIncidents,
      };
    }

    async findManyIncidents() {
      return this.prisma.incident.findMany({
        orderBy: { startedAt: 'desc' },
        include: {
          site: {
            select: {
              name: true,
              domain: true,
            },
          },
        },
        take: 50,
      });
    }

    async findManyUptimeChecks() {
      return this.prisma.uptimeCheck.findMany({
        orderBy: { checkedAt: 'desc' },
        include: {
          site: {
            select: {
              name: true,
              domain: true,
            },
          },
        },
        take: 100,
      });
    }
  }
  ```

- [ ] **Step 2: Update MonitoringController**
  Modify [monitoring.controller.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/modules/monitoring/monitoring.controller.ts) to call the updated service.
  Replace:
  ```typescript
    @Get('overview')
    overview() { return this.monitoringService.overview(); }

    @Get('incidents')
    incidents() { return { data: [] }; }

    @Get('uptime-checks')
    uptimeChecks() { return { data: [] }; }
  ```
  With:
  ```typescript
    @Get('overview')
    overview() { return this.monitoringService.overview(); }

    @Get('incidents')
    async incidents() {
      const data = await this.monitoringService.findManyIncidents();
      return { data };
    }

    @Get('uptime-checks')
    async uptimeChecks() {
      const data = await this.monitoringService.findManyUptimeChecks();
      return { data };
    }
  ```

- [ ] **Step 3: Implement Database Queries for SitesController Uptime & Incidents**
  Modify [sites.controller.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/modules/sites/sites.controller.ts) to query database results instead of returning stubs.
  Replace:
  ```typescript
    @Get(':id/uptime')
    @Roles(UserRole.ADMIN)
    uptime(@Param('id') id: string) {
      return { siteId: id, data: [] };
    }

    @Get(':id/incidents')
    @Roles(UserRole.ADMIN)
    incidents(@Param('id') id: string) {
      return { siteId: id, data: [] };
    }
  ```
  With:
  ```typescript
    @Get(':id/uptime')
    @Roles(UserRole.ADMIN)
    async uptime(@Param('id') id: string) {
      // Get 50 recent uptime checks
      const checks = await this.sitesService.prisma.uptimeCheck.findMany({
        where: { siteId: id },
        orderBy: { checkedAt: 'desc' },
        take: 50,
      });

      // Calculate 24-hour uptime ratio
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentChecks = await this.sitesService.prisma.uptimeCheck.findMany({
        where: { siteId: id, checkedAt: { gte: oneDayAgo } },
      });
      const total = recentChecks.length;
      const up = recentChecks.filter(c => c.isUp).length;
      const uptimeRatio = total > 0 ? Number(((up / total) * 100).toFixed(2)) : 100.0;

      return { siteId: id, uptimeRatio, data: checks };
    }

    @Get(':id/incidents')
    @Roles(UserRole.ADMIN)
    async incidents(@Param('id') id: string) {
      const incidents = await this.sitesService.prisma.incident.findMany({
        where: { siteId: id },
        orderBy: { startedAt: 'desc' },
        take: 20,
      });
      return { siteId: id, data: incidents };
    }
  ```

- [ ] **Step 4: Commit Backend API changes**
  Run:
  ```bash
  git add apps/api/src/modules/monitoring/monitoring.service.ts apps/api/src/modules/monitoring/monitoring.controller.ts apps/api/src/modules/sites/sites.controller.ts
  git commit -m "feat: wire real database queries for site-specific and global monitoring endpoints"
  ```

---

### Task 3: Frontend Tab Integration for Uptime & Incidents

**Files:**
- Modify: `apps/web/app/sites/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/sites/:id/uptime`, `GET /api/sites/:id/incidents`
- Produces: Integrated UI elements showing Uptime ratio, historical ping logs, and active/resolved incidents.

- [ ] **Step 1: Add new tab to SiteDetailPage**
  Modify [page.tsx](file:///Users/djoker/Documents/ANTIGRAVITY/apps/web/app/sites/[id]/page.tsx) to add the "Uptime & Incidents" tab state, fetch the additional data, and display it.
  
  Introduce new React states at top of Component:
  ```typescript
    const [uptimeData, setUptimeData] = useState<{ uptimeRatio: number; data: any[] }>({ uptimeRatio: 100, data: [] });
    const [incidentsData, setIncidentsData] = useState<any[]>([]);
    const [loadingChecks, setLoadingChecks] = useState(false);
  ```
  *(Make sure to define types or use existing ones without triggering no-explicit-any. We can define simple interfaces:)*
  Add interfaces above Component:
  ```typescript
  interface UptimeCheckInfo {
    id: string;
    checkedAt: string;
    statusCode: number | null;
    responseTimeMs: number | null;
    isUp: boolean;
    errorMessage: string | null;
  }

  interface IncidentInfo {
    id: string;
    incidentType: string;
    severity: string;
    startedAt: string;
    endedAt: string | null;
    status: string;
    summary: string | null;
  }
  ```
  And declare state with types:
  ```typescript
    const [uptimeRatio, setUptimeRatio] = useState<number>(100);
    const [uptimeChecks, setUptimeChecks] = useState<UptimeCheckInfo[]>([]);
    const [incidentsList, setIncidentsList] = useState<IncidentInfo[]>([]);
  ```

- [ ] **Step 2: Update fetchData to load monitoring data**
  Extend `fetchData` in [page.tsx](file:///Users/djoker/Documents/ANTIGRAVITY/apps/web/app/sites/[id]/page.tsx):
  ```typescript
        // Fetch core
        const coreRes = await fetch(`http://localhost:3003/api/sites/${id}/core`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (coreRes.ok) {
          const coreJson = await coreRes.json();
          setCoreData(coreJson);
        }

        // Fetch Uptime
        const uptimeRes = await fetch(`http://localhost:3003/api/sites/${id}/uptime`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (uptimeRes.ok) {
          const uptimeJson = await uptimeRes.json();
          setUptimeRatio(uptimeJson.uptimeRatio);
          setUptimeChecks(uptimeJson.data || []);
        }

        // Fetch Incidents
        const incidentsRes = await fetch(`http://localhost:3003/api/sites/${id}/incidents`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (incidentsRes.ok) {
          const incidentsJson = await incidentsRes.json();
          setIncidentsList(incidentsJson.data || []);
        }
  ```

- [ ] **Step 3: Update Tab Navigation to include Uptime**
  Add the Uptime tab in [page.tsx](file:///Users/djoker/Documents/ANTIGRAVITY/apps/web/app/sites/[id]/page.tsx):
  ```typescript
          {[
            { id: "overview", label: "Overview" },
            { id: "plugins", label: `Plugins (${pluginsData.length})` },
            { id: "themes", label: `Themes (${themesData.length})` },
            { id: "core", label: "Core Version" },
            { id: "uptime", label: `Uptime & Incidents (${incidentsList.filter(i => i.status === "OPEN").length})` },
          ].map((tab) => (
  ```

- [ ] **Step 4: Render Uptime and Incidents tab content**
  Add the tab panel rendering code in [page.tsx](file:///Users/djoker/Documents/ANTIGRAVITY/apps/web/app/sites/[id]/page.tsx):
  Below the `{activeTab === "core" && ( ... )}` chunk:
  ```typescript
            {activeTab === "uptime" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h3 className="text-lg font-bold text-white font-heading">Uptime & Outages</h3>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 flex items-center gap-2">
                    <span className="text-zinc-500 text-xs uppercase">24h Uptime Ratio</span>
                    <span className={`text-lg font-extrabold ${uptimeRatio >= 99 ? "text-emerald-400" : "text-yellow-500"}`}>
                      {uptimeRatio}%
                    </span>
                  </div>
                </div>

                {/* Incidents Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Incidents Registry</h4>
                  {incidentsList.length === 0 ? (
                    <div className="rounded-lg border border-zinc-900 bg-zinc-950/40 p-4 text-center text-zinc-500 text-sm">
                      No incidents logged for this site.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/20">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-zinc-900 bg-zinc-900/40 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                            <th className="p-4">Incident Type</th>
                            <th className="p-4">Summary</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Duration</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                          {incidentsList.map((inc) => (
                            <tr key={inc.id} className="hover:bg-zinc-900/30 transition">
                              <td className="p-4 font-mono font-semibold text-white">{inc.incidentType}</td>
                              <td className="p-4 text-zinc-300">{inc.summary || "No description provided"}</td>
                              <td className="p-4">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  inc.status === "OPEN"
                                    ? "bg-red-950/40 text-red-400 border border-red-900/30"
                                    : "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30"
                                }`}>
                                  {inc.status}
                                </span>
                              </td>
                              <td className="p-4 text-zinc-400 text-xs">
                                <div>Start: {new Date(inc.startedAt).toLocaleString()}</div>
                                {inc.endedAt ? (
                                  <div>End: {new Date(inc.endedAt).toLocaleString()}</div>
                                ) : (
                                  <div className="text-red-400">Active (Ongoing)</div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Ping Log History */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Recent Ping Logs</h4>
                  {uptimeChecks.length === 0 ? (
                    <div className="rounded-lg border border-zinc-900 bg-zinc-950/40 p-4 text-center text-zinc-500 text-sm">
                      No ping checks recorded yet.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/20">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-zinc-900 bg-zinc-900/40 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                            <th className="p-4">Timestamp</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Response Time</th>
                            <th className="p-4">Log</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                          {uptimeChecks.map((check) => (
                            <tr key={check.id} className="hover:bg-zinc-900/30 transition">
                              <td className="p-4 text-zinc-400 text-xs">{new Date(check.checkedAt).toLocaleString()}</td>
                              <td className="p-4">
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                                  check.isUp
                                    ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30"
                                    : "bg-red-950/40 text-red-400 border border-red-900/30"
                                }`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${
                                    check.isUp ? "bg-emerald-500" : "bg-red-500"
                                  }`} />
                                  {check.isUp ? "ONLINE" : "OFFLINE"}
                                </span>
                              </td>
                              <td className="p-4 text-white font-semibold">
                                {check.responseTimeMs !== null ? `${check.responseTimeMs} ms` : "—"}
                              </td>
                              <td className="p-4 text-zinc-400 text-xs">
                                {check.errorMessage || `HTTP ${check.statusCode || "OK"}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
  ```

- [ ] **Step 5: Commit Frontend Integration changes**
  Run:
  ```bash
  git add "apps/web/app/sites/[id]/page.tsx"
  git commit -m "feat: build Uptime & Incidents UI tab panel with backend query bindings"
  ```

---

## Verification Plan

### Automated Tests
- Run `npm run lint -w apps/web` to confirm no ESLint errors exist.
- Run `npm run build:all` to ensure TypeScript compilation passes.

### Manual Verification
1. **Worker Background Loops**:
   - Start worker: `npm run dev:worker`.
   - Verify logs contain `[worker] Starting uptime checks...`.
   - Shutdown dummy local server or simulate errors (e.g., set domain to unresolvable value in DB) to trigger failures.
   - Verify that failure creates an entry in `UptimeCheck` with `isUp = false`.
   - Check if 3 consecutive failures trigger a new incident with status `OPEN` in DB.
2. **Dashboard Render**:
   - Log in to frontend. Open a site dashboard, navigate to "Uptime & Incidents" tab.
   - Confirm Uptime ratio % and incidents/checks load correctly.
