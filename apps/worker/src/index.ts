import { Worker, Job as BullJob } from 'bullmq';
import { PrismaClient, JobStatus, LogLevel, AuditResult } from '@wpcc/database';
import { createDecipheriv, createHmac } from 'node:crypto';
import * as dotenv from 'dotenv';
import { setInterval } from 'node:timers';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();
const ALGORITHM = 'aes-256-gcm';

function decrypt(encryptedText: string, secretKeyHex: string): string {
  const key = Buffer.from(secretKeyHex, 'hex');
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const authTag = Buffer.from(parts[2], 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function getEncryptionKey(): string {
  const key = process.env.AGENT_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('AGENT_ENCRYPTION_KEY environment variable is missing');
  }
  return key;
}

function getActionSlug(jobType: string): string {
  switch (jobType) {
    case 'UPDATE_PLUGIN': return 'update-plugin';
    case 'ACTIVATE_PLUGIN': return 'activate-plugin';
    case 'DEACTIVATE_PLUGIN': return 'deactivate-plugin';
    case 'DELETE_PLUGIN': return 'delete-plugin';
    case 'UPDATE_THEME': return 'update-theme';
    case 'DELETE_THEME': return 'delete-theme';
    case 'UPDATE_CORE': return 'update-core';
    case 'TOGGLE_MAINTENANCE': return 'toggle-maintenance';
    default:
      throw new Error(`Unknown job type: ${jobType}`);
  }
}

async function logToJob(jobId: string, level: LogLevel, message: string, context?: any) {
  try {
    await prisma.jobLog.create({
      data: {
        jobId,
        level,
        message,
        contextJson: context || {},
      },
    });
  } catch (err: any) {
    console.error(`Failed to write job log: ${err.message}`);
  }
}

async function resyncSite(siteId: string, secretKey: string, siteUrl: string) {
  const method = 'POST';
  const path = '/wpcc/v1/execute/sync-inventory';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyObj = {};
  const bodyStr = JSON.stringify(bodyObj);

  const message = `${method}|${path}|${timestamp}|${bodyStr}`;
  const signature = createHmac('sha256', secretKey).update(message).digest('hex');

  const targetUrl = `${siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/sync-inventory`;
  const response = await fetch(targetUrl, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-wpcc-signature': signature,
      'x-wpcc-timestamp': timestamp,
    },
    body: bodyStr,
  });

  if (!response.ok) {
    throw new Error(`Inventory sync returned status ${response.status}`);
  }

  const responseBody = await response.json() as any;
  if (!responseBody.success || !responseBody.data) {
    throw new Error(responseBody.message || 'Inventory sync failed');
  }

  const { systemInfo, plugins, themes, core } = responseBody.data;

  // Update Site Table
  await prisma.site.update({
    where: { id: siteId },
    data: {
      wpVersion: systemInfo.wpVersion,
      phpVersion: systemInfo.phpVersion,
      wpAgentVersion: systemInfo.wpAgentVersion,
      timezone: systemInfo.timezone,
      lastSeenAt: new Date(),
    },
  });

  // Upsert plugins
  const activeSlugs = plugins.map((p: any) => p.slug);
  for (const plugin of plugins) {
    await prisma.plugin.upsert({
      where: {
        siteId_slug: {
          siteId,
          slug: plugin.slug,
        },
      },
      update: {
        name: plugin.name,
        versionInstalled: plugin.versionInstalled,
        versionLatest: plugin.versionLatest,
        isActive: plugin.isActive,
        updateAvailable: plugin.updateAvailable,
        autoUpdateEnabled: plugin.autoUpdateEnabled,
        lastSyncedAt: new Date(),
      },
      create: {
        siteId,
        slug: plugin.slug,
        name: plugin.name,
        versionInstalled: plugin.versionInstalled,
        versionLatest: plugin.versionLatest,
        isActive: plugin.isActive,
        updateAvailable: plugin.updateAvailable,
        autoUpdateEnabled: plugin.autoUpdateEnabled,
        lastSyncedAt: new Date(),
      },
    });
  }
  await prisma.plugin.deleteMany({
    where: {
      siteId,
      slug: { notIn: activeSlugs },
    },
  });

  // Upsert themes
  const activeThemeSlugs = themes.map((t: any) => t.slug);
  for (const theme of themes) {
    await prisma.theme.upsert({
      where: {
        siteId_slug: {
          siteId,
          slug: theme.slug,
        },
      },
      update: {
        name: theme.name,
        versionInstalled: theme.versionInstalled,
        versionLatest: theme.versionLatest,
        isActive: theme.isActive,
        updateAvailable: theme.updateAvailable,
        lastSyncedAt: new Date(),
      },
      create: {
        siteId,
        slug: theme.slug,
        name: theme.name,
        versionInstalled: theme.versionInstalled,
        versionLatest: theme.versionLatest,
        isActive: theme.isActive,
        updateAvailable: theme.updateAvailable,
        lastSyncedAt: new Date(),
      },
    });
  }
  await prisma.theme.deleteMany({
    where: {
      siteId,
      slug: { notIn: activeThemeSlugs },
    },
  });

  // Upsert core version
  await prisma.coreVersion.upsert({
    where: { siteId },
    update: {
      versionInstalled: core.versionInstalled,
      versionLatest: core.versionLatest,
      updateAvailable: core.updateAvailable,
      lastSyncedAt: new Date(),
    },
    create: {
      siteId,
      versionInstalled: core.versionInstalled,
      versionLatest: core.versionLatest,
      updateAvailable: core.updateAvailable,
      lastSyncedAt: new Date(),
    },
  });
}

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6380;

const worker = new Worker(
  'jobs',
  async (bullJob: BullJob) => {
    const { jobId } = bullJob.data;
    console.log(`[worker] Processing job ${jobId}`);

    const dbJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        site: {
          include: {
            credential: true,
          },
        },
      },
    });

    if (!dbJob) {
      console.error(`[worker] Job ${jobId} not found in database`);
      return;
    }

    const actionSlug = getActionSlug(dbJob.jobType);

    // Move job to RUNNING state
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    await logToJob(jobId, LogLevel.INFO, `Started processing remote action '${actionSlug}'`);

    const site = dbJob.site;
    if (!site || site.connectionStatus !== 'CONNECTED' || !site.credential) {
      const errorMsg = 'Target site is not connected or missing credentials';
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          errorMessage: errorMsg,
          endedAt: new Date(),
        },
      });

      await logToJob(jobId, LogLevel.ERROR, errorMsg);
      await prisma.auditLog.create({
        data: {
          siteId: dbJob.siteId,
          action: `site.${actionSlug}`,
          entityType: 'site',
          entityId: dbJob.siteId,
          result: AuditResult.FAILURE,
          payloadJson: { error: errorMsg },
        },
      });
      return;
    }

    try {
      const secretKey = decrypt(site.credential.secretKeyEncrypted, getEncryptionKey());
      const method = 'POST';
      const path = `/wpcc/v1/execute/${actionSlug}`;
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const bodyObj = (dbJob.payloadJson as Record<string, any>) || {};
      const bodyStr = JSON.stringify(bodyObj);

      // Create HMAC signature
      const message = `${method}|${path}|${timestamp}|${bodyStr}`;
      const signature = createHmac('sha256', secretKey).update(message).digest('hex');

      const targetUrl = `${site.siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/${actionSlug}`;

      await logToJob(jobId, LogLevel.INFO, `Sending request to WordPress Agent: POST ${targetUrl}`);

      const response = await fetch(targetUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-wpcc-signature': signature,
          'x-wpcc-timestamp': timestamp,
        },
        body: bodyStr,
      });

      if (!response.ok) {
        throw new Error(`WordPress Agent responded with HTTP status ${response.status}`);
      }

      const resBody = (await response.json()) as any;
      if (!resBody.success) {
        throw new Error(resBody.error || resBody.message || 'WordPress Agent executed action with failure');
      }

      await logToJob(jobId, LogLevel.INFO, `Action executed successfully: ${resBody.message || 'Success'}`);

      // Set status to SUCCESS
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.SUCCESS,
          resultJson: resBody,
          endedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          siteId: site.id,
          action: `site.${actionSlug}`,
          entityType: 'site',
          entityId: site.id,
          result: AuditResult.SUCCESS,
          payloadJson: { result: resBody },
        },
      });

      // Trigger inventory sync in background to fetch updated site status
      await logToJob(jobId, LogLevel.INFO, 'Triggering site inventory resync in background...');
      await resyncSite(site.id, secretKey, site.siteUrl);
      await logToJob(jobId, LogLevel.INFO, 'Site inventory resync completed.');

    } catch (err: any) {
      console.error(`[worker] Job ${jobId} failed:`, err);
      const errorMsg = err.message || 'Unknown error occurred';

      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          errorMessage: errorMsg,
          endedAt: new Date(),
        },
      });

      await logToJob(jobId, LogLevel.ERROR, `Action failed: ${errorMsg}`);

      await prisma.auditLog.create({
        data: {
          siteId: site.id,
          action: `site.${actionSlug}`,
          entityType: 'site',
          entityId: site.id,
          result: AuditResult.FAILURE,
          payloadJson: { error: errorMsg },
        },
      });
    }
  },
  {
    connection: {
      host: redisHost,
      port: redisPort,
    },
  }
);

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed with error:`, err);
});

// Real-time Uptime Monitoring Engine
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
setInterval(() => {
  Promise.resolve().then(() => runUptimeChecks());
}, intervalSeconds * 1000);

// Run once immediately on start after microtask delay
Promise.resolve().then(() => runUptimeChecks());

// Keep other mocks ticking for background compatibility
function tick(name: string): void {
  console.log(`[worker] ${name} tick at ${new Date().toISOString()}`);
}

setInterval(() => tick('analytics-sync'), 60 * 60 * 1000);
setInterval(() => tick('dispatch-jobs'), 15 * 1000);

console.log('Worker bootstrap with BullMQ Worker started successfully');
