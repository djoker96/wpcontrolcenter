import { Worker, Job as BullJob } from 'bullmq';
import { PrismaClient, JobStatus, LogLevel, AuditResult, AnalyticsSource, NotificationChannelType, NotificationDeliveryStatus } from '@wpcc/database';
import { decrypt, encrypt } from '@wpcc/shared';
import { createHmac } from 'node:crypto';
import * as dotenv from 'dotenv';
import { setInterval } from 'node:timers';
import * as path from 'node:path';
import * as tls from 'node:tls';
import * as fs from 'node:fs';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

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
    case 'INSTALL_PLUGIN': return 'install-plugin';
    case 'CLEAR_CACHE': return 'clear-cache';
    case 'OPTIMIZE_DATABASE': return 'optimize-database';
    case 'UPDATE_ROBOTS_TXT': return 'update-robots-txt';
    case 'UPDATE_HTACCESS': return 'update-htaccess';
    case 'UPDATE_PHP_CONFIG': return 'update-php-config';
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

async function handleCreateBackupJob(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { site: { include: { credential: true } } },
  });

  if (!job || !job.site || !job.site.credential) {
    throw new Error(`Job or credentials not found for ID ${jobId}`);
  }

  const { backupId, backupType } = job.payloadJson as { backupId: string, backupType: string };

  await prisma.job.update({ where: { id: jobId }, data: { status: 'RUNNING', startedAt: new Date() } });
  await prisma.siteBackup.update({ where: { id: backupId }, data: { status: 'RUNNING' } });

  const secretKey = decrypt(job.site.credential.secretKeyEncrypted, getEncryptionKey());
  const method = 'POST';
  const pathUrl = '/wpcc/v1/execute/create-backup';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyObj = { type: backupType };
  const bodyStr = JSON.stringify(bodyObj);

  const message = `${method}|${pathUrl}|${timestamp}|${bodyStr}`;
  const signature = createHmac('sha256', secretKey).update(message).digest('hex');
  const targetUrl = `${job.site.siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/create-backup`;

  try {
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
      throw new Error(`Agent backup create returned status ${response.status}`);
    }

    const json = await response.json() as any;
    if (!json.success || !json.filename) {
      throw new Error(json.message || 'Backup failed on WordPress Agent');
    }

    const filename = json.filename;

    // Now download the backup file from Agent
    const downloadPath = `/wpcc/v1/execute/download-backup`;
    const downloadQuery = `?filename=${encodeURIComponent(filename)}`;
    const downloadMsg = `GET|${downloadPath}|${timestamp}|`;
    const downloadSignature = createHmac('sha256', secretKey).update(downloadMsg).digest('hex');
    const downloadTarget = `${job.site.siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/download-backup${downloadQuery}`;

    const fileRes = await fetch(downloadTarget, {
      method: 'GET',
      headers: {
        'x-wpcc-signature': downloadSignature,
        'x-wpcc-timestamp': timestamp,
      },
    });

    if (!fileRes.ok) {
      throw new Error(`Failed to download backup: HTTP ${fileRes.status}`);
    }

    const storageDir = path.resolve(__dirname, '../../storage/backups', job.siteId);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    
    const fileDest = path.join(storageDir, filename);
    const arrayBuffer = await fileRes.arrayBuffer();
    fs.writeFileSync(fileDest, Buffer.from(arrayBuffer));

    // Delete the backup on the agent to save space
    const deleteTarget = `${job.site.siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/delete-backup`;
    const deleteBody = JSON.stringify({ filename });
    const deleteMsg = `POST|/wpcc/v1/execute/delete-backup|${timestamp}|${deleteBody}`;
    const deleteSignature = createHmac('sha256', secretKey).update(deleteMsg).digest('hex');
    await fetch(deleteTarget, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wpcc-signature': deleteSignature,
        'x-wpcc-timestamp': timestamp,
      },
      body: deleteBody,
    });

    const downloadUrl = `/api/sites/${job.siteId}/backups/${backupId}/download`;
    await prisma.siteBackup.update({
      where: { id: backupId },
      data: {
        status: 'COMPLETED',
        filename,
        sizeBytes: json.size,
        downloadUrl,
      },
    });

    await prisma.job.update({ where: { id: jobId }, data: { status: 'SUCCESS', endedAt: new Date() } });
  } catch (err: any) {
    const errMsg = err.message || 'Unknown error';
    await prisma.siteBackup.update({ where: { id: backupId }, data: { status: 'FAILED', errorMessage: errMsg } });
    await prisma.job.update({ where: { id: jobId }, data: { status: 'FAILED', endedAt: new Date(), errorMessage: errMsg } });
  }
}

async function handleRestoreBackupJob(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { site: { include: { credential: true } } },
  });

  if (!job || !job.site || !job.site.credential) {
    throw new Error(`Job or credentials not found for ID ${jobId}`);
  }

  const { backupId } = job.payloadJson as { backupId: string };
  const backup = await prisma.siteBackup.findUnique({ where: { id: backupId } });
  if (!backup) {
    throw new Error(`Backup file record not found for ID ${backupId}`);
  }

  await prisma.job.update({ where: { id: jobId }, data: { status: 'RUNNING', startedAt: new Date() } });

  const storageDir = path.resolve(__dirname, '../../storage/backups', job.siteId);
  const filePath = path.join(storageDir, backup.filename);

  if (!fs.existsSync(filePath)) {
    throw new Error('Backup file is missing from backend storage');
  }

  const secretKey = decrypt(job.site.credential.secretKeyEncrypted, getEncryptionKey());
  const timestamp = Math.floor(Date.now() / 1000).toString();

  try {
    // 1. Upload file to agent
    const fileData = fs.readFileSync(filePath);
    const uploadPath = '/wpcc/v1/execute/upload-backup';
    const uploadQuery = `?filename=${encodeURIComponent(backup.filename)}`;
    // For binary body, hash/HMAC is calculated over raw bytes
    const messageBytes = Buffer.concat([
      Buffer.from(`POST|${uploadPath}|${timestamp}|`),
      fileData
    ]);
    const uploadSignature = createHmac('sha256', secretKey).update(messageBytes).digest('hex');
    const uploadTarget = `${job.site.siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/upload-backup${uploadQuery}`;

    const uploadRes = await fetch(uploadTarget, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-wpcc-signature': uploadSignature,
        'x-wpcc-timestamp': timestamp,
      },
      body: fileData,
    });

    if (!uploadRes.ok) {
      throw new Error(`Failed to upload backup to Agent: HTTP ${uploadRes.status}`);
    }

    // 2. Trigger restore on agent
    const restoreTarget = `${job.site.siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/restore-backup`;
    const restoreBody = JSON.stringify({ filename: backup.filename });
    const restoreMsg = `POST|/wpcc/v1/execute/restore-backup|${timestamp}|${restoreBody}`;
    const restoreSignature = createHmac('sha256', secretKey).update(restoreMsg).digest('hex');

    const restoreRes = await fetch(restoreTarget, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wpcc-signature': restoreSignature,
        'x-wpcc-timestamp': timestamp,
      },
      body: restoreBody,
    });

    if (!restoreRes.ok) {
      throw new Error(`Failed to restore backup: HTTP ${restoreRes.status}`);
    }

    const json = await restoreRes.json() as any;
    if (!json.success) {
      throw new Error(json.message || 'Agent failed to restore files/database');
    }

    await prisma.job.update({ where: { id: jobId }, data: { status: 'SUCCESS', endedAt: new Date() } });
  } catch (err: any) {
    const errMsg = err.message || 'Unknown error';
    await prisma.job.update({ where: { id: jobId }, data: { status: 'FAILED', endedAt: new Date(), errorMessage: errMsg } });
  }
}

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379;

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

    if (dbJob.jobType === 'CREATE_BACKUP') {
      await handleCreateBackupJob(jobId);
      return;
    }
    if (dbJob.jobType === 'RESTORE_BACKUP') {
      await handleRestoreBackupJob(jobId);
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s timeout

      const response = await fetch(targetUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-wpcc-signature': signature,
          'x-wpcc-timestamp': timestamp,
        },
        body: bodyStr,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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

      // If it's a configuration edit, write a snapshot
      if (['UPDATE_ROBOTS_TXT', 'UPDATE_HTACCESS', 'UPDATE_PHP_CONFIG'].includes(dbJob.jobType)) {
        let robotsTxtContent: string | null = null;
        let htaccessContent: string | null = null;
        let phpIniContent: string | null = null;

        if (dbJob.jobType === 'UPDATE_ROBOTS_TXT') {
          robotsTxtContent = bodyObj.content || '';
        } else if (dbJob.jobType === 'UPDATE_HTACCESS') {
          htaccessContent = bodyObj.content || '';
        } else if (dbJob.jobType === 'UPDATE_PHP_CONFIG') {
          phpIniContent = JSON.stringify(bodyObj.settings || {});
        }

        await prisma.maintenanceSnapshot.create({
          data: {
            siteId: site.id,
            robotsTxtContent,
            htaccessContent,
            phpIniContent,
            createdByUserId: dbJob.initiatedByUserId,
          },
        });
      }

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
    // Worker-level options for detecting and retrying hung jobs
    stalledInterval: 30_000,       // Check every 30s for stalled jobs
    maxStalledCount: 1,           // Retry once if stalled, then fail
  }
);

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed with error:`, err);
});

// Real-time Uptime Alerts & Notification Dispatcher Engine
async function dispatchNotifications(incidentId: string, eventType: 'INCIDENT_OPENED' | 'INCIDENT_RESOLVED') {
  console.log(`[worker] Dispatching alerts for incident ${incidentId} (Event: ${eventType})`);
  try {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: { site: true },
    });

    if (!incident) return;

    const channels = await prisma.notification.findMany({
      where: { isEnabled: true },
    });

    for (const channel of channels) {
      // Create pending event record
      const event = await prisma.notificationEvent.create({
        data: {
          siteId: incident.siteId,
          incidentId: incident.id,
          notificationId: channel.id,
          eventType,
          channelType: channel.channelType,
          destination: channel.destination,
          status: NotificationDeliveryStatus.PENDING,
        },
      });

      // Async sending trigger
      Promise.resolve().then(async () => {
        let success = false;
        let payload: any = {};
        
        try {
          const messageText = eventType === 'INCIDENT_OPENED'
            ? `🚨 [WP Control Center] INCIDENT ALERT!\nWebsite: ${incident.site?.name} (${incident.site?.siteUrl})\nStatus: DOWN\nSeverity: ${incident.severity}\nSummary: ${incident.summary}\nTime: ${incident.startedAt.toLocaleString()}`
            : `✅ [WP Control Center] INCIDENT RESOLVED!\nWebsite: ${incident.site?.name} (${incident.site?.siteUrl})\nStatus: BACK ONLINE\nTime: ${new Date().toLocaleString()}`;

          if (channel.channelType === NotificationChannelType.EMAIL) {
            console.log(`[worker] [EMAIL SIMULATION] Sent to ${channel.destination}:\n${messageText}`);
            success = true;
            payload = { message: messageText, simulated: true };
          } else if (channel.channelType === NotificationChannelType.WEBHOOK) {
            const res = await fetch(channel.destination, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: eventType,
                site: { id: incident.siteId, name: incident.site?.name, url: incident.site?.siteUrl },
                incident: { id: incident.id, severity: incident.severity, summary: incident.summary, startedAt: incident.startedAt }
              }),
            });
            success = res.ok;
            payload = { statusCode: res.status };
          } else if (channel.channelType === NotificationChannelType.SLACK || channel.channelType === NotificationChannelType.DISCORD) {
            const res = await fetch(channel.destination, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: messageText }),
            });
            success = res.ok;
            payload = { statusCode: res.status };
          } else if (channel.channelType === NotificationChannelType.TELEGRAM) {
            const [botToken, chatId] = channel.destination.split(':');
            if (botToken && chatId) {
              const tgUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
              const res = await fetch(tgUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: messageText }),
              });
              success = res.ok;
              payload = await res.json();
            } else {
              throw new Error('Telegram destination format must be token:chatId');
            }
          }
        } catch (err: any) {
          console.error(`[worker] Failed to send alert to channel ${channel.id}:`, err);
          payload = { error: err.message };
        }

        // Update event result
        await prisma.notificationEvent.update({
          where: { id: event.id },
          data: {
            status: success ? NotificationDeliveryStatus.SENT : NotificationDeliveryStatus.FAILED,
            payloadJson: payload,
            sentAt: success ? new Date() : null,
          },
        });
      });
    }
  } catch (err) {
    console.error('[worker] Error dispatching alerts:', err);
  }
}

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
          for (const incident of openIncidents) {
            await prisma.incident.update({
              where: { id: incident.id },
              data: {
                status: 'RESOLVED',
                endedAt: new Date(),
                summary: 'Website is back up and responding normally.',
              },
            });
            // Trigger alert dispatch for recovery
            await dispatchNotifications(incident.id, 'INCIDENT_RESOLVED');
          }
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
            const newIncident = await prisma.incident.create({
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
            // Trigger alert dispatch for incident opened
            await dispatchNotifications(newIncident.id, 'INCIDENT_OPENED');
          }
        }
      }
    }
  } catch (error: any) {
    console.error('[worker] Error running uptime checks:', error);
  }
}

async function getValidAccessToken(accountId: string): Promise<string> {
  const account = await prisma.integrationAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error(`Integration account with ID ${accountId} not found`);
  }

  const encKey = getEncryptionKey();
  const isExpired = !account.expiresAt || account.expiresAt.getTime() - 60000 < Date.now();

  if (!isExpired) {
    return decrypt(account.accessTokenEncrypted, encKey);
  }

  if (!account.refreshTokenEncrypted) {
    throw new Error('Refresh token is missing');
  }

  const refreshToken = decrypt(account.refreshTokenEncrypted, encKey);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth configurations are missing');
  }

  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!refreshResponse.ok) {
    await prisma.integrationAccount.update({
      where: { id: accountId },
      data: { status: 'ERROR' },
    });
    throw new Error(`Failed to refresh Google OAuth token`);
  }

  const refreshData = (await refreshResponse.json()) as any;
  const newAccessToken = refreshData.access_token;
  const newExpiresIn = refreshData.expires_in;

  const newAccessTokenEncrypted = encrypt(newAccessToken, encKey);
  const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000);

  await prisma.integrationAccount.update({
    where: { id: accountId },
    data: {
      accessTokenEncrypted: newAccessTokenEncrypted,
      expiresAt: newExpiresAt,
      status: 'ACTIVE',
    },
  });

  return newAccessToken;
}

async function syncAnalyticsData() {
  console.log(`[worker] Starting Google Analytics and Search Console synchronization...`);
  try {
    const integrations = await prisma.siteIntegration.findMany({
      where: {
        provider: 'GOOGLE',
        status: 'ACTIVE',
      },
      include: {
        site: true,
      },
    });

    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = new Date().toISOString().split('T')[0];

    for (const integration of integrations) {
      console.log(`[worker] Syncing analytics for site ${integration.site.domain}...`);
      try {
        const accessToken = await getValidAccessToken(integration.integrationAccountId);

        // 1. Sync GA4 Data
        if (integration.externalPropertyId) {
          // GA4 Daily
          const ga4DailyRes = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${integration.externalPropertyId}:runReport`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              dateRanges: [{ startDate: startDateStr, endDate: endDateStr }],
              dimensions: [{ name: 'date' }],
              metrics: [
                { name: 'sessions' },
                { name: 'activeUsers' },
                { name: 'screenPageViews' }
              ],
            }),
          });

          if (ga4DailyRes.ok) {
            const ga4DailyData = (await ga4DailyRes.json()) as any;
            if (ga4DailyData.rows) {
              for (const row of ga4DailyData.rows) {
                const dateRaw = row.dimensionValues[0].value;
                const metricDate = new Date(
                  Number(dateRaw.slice(0, 4)),
                  Number(dateRaw.slice(4, 6)) - 1,
                  Number(dateRaw.slice(6, 8))
                );

                const sessions = Number(row.metricValues[0].value || 0);
                const users = Number(row.metricValues[1].value || 0);
                const pageviews = Number(row.metricValues[2].value || 0);

                await prisma.analyticsDaily.upsert({
                  where: {
                    siteId_metricDate_source: {
                      siteId: integration.siteId,
                      metricDate,
                      source: AnalyticsSource.GA4,
                    },
                  },
                  update: { sessions, users, pageviews },
                  create: {
                    siteId: integration.siteId,
                    metricDate,
                    source: AnalyticsSource.GA4,
                    sessions,
                    users,
                    pageviews,
                  },
                });
              }
            }
          }

          // GA4 Top Pages
          const ga4PagesRes = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${integration.externalPropertyId}:runReport`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              dateRanges: [{ startDate: startDateStr, endDate: endDateStr }],
              dimensions: [{ name: 'date' }, { name: 'pagePath' }, { name: 'pageTitle' }],
              metrics: [{ name: 'screenPageViews' }, { name: 'sessions' }],
              limit: 20,
            }),
          });

          if (ga4PagesRes.ok) {
            const ga4PagesData = (await ga4PagesRes.json()) as any;
            if (ga4PagesData.rows) {
              for (const row of ga4PagesData.rows) {
                const dateRaw = row.dimensionValues[0].value;
                const metricDate = new Date(
                  Number(dateRaw.slice(0, 4)),
                  Number(dateRaw.slice(4, 6)) - 1,
                  Number(dateRaw.slice(6, 8))
                );
                const pagePath = row.dimensionValues[1].value || '/';
                const pageTitle = row.dimensionValues[2].value || '';
                const pageviews = Number(row.metricValues[0].value || 0);
                const sessions = Number(row.metricValues[1].value || 0);

                await prisma.topPageDaily.deleteMany({
                  where: {
                    siteId: integration.siteId,
                    metricDate,
                    source: AnalyticsSource.GA4,
                    pagePath,
                  },
                });

                await prisma.topPageDaily.create({
                  data: {
                    siteId: integration.siteId,
                    metricDate,
                    source: AnalyticsSource.GA4,
                    pagePath,
                    pageTitle,
                    pageviews,
                    sessions,
                  },
                });
              }
            }
          }
        }

        // 2. Sync GSC Data
        if (integration.externalSiteIdentifier) {
          // GSC Daily
          const gscDailyRes = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(integration.externalSiteIdentifier)}/searchAnalytics/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              startDate: startDateStr,
              endDate: endDateStr,
              dimensions: ['date'],
            }),
          });

          if (gscDailyRes.ok) {
            const gscDailyData = (await gscDailyRes.json()) as any;
            if (gscDailyData.rows) {
              for (const row of gscDailyData.rows) {
                const metricDate = new Date(row.keys[0]);
                const clicks = Number(row.clicks || 0);
                const impressions = Number(row.impressions || 0);
                const ctr = Number(row.ctr || 0);
                const avgPosition = Number(row.position || 0);

                await prisma.analyticsDaily.upsert({
                  where: {
                    siteId_metricDate_source: {
                      siteId: integration.siteId,
                      metricDate,
                      source: AnalyticsSource.GSC,
                    },
                  },
                  update: { clicks, impressions, ctr, avgPosition },
                  create: {
                    siteId: integration.siteId,
                    metricDate,
                    source: AnalyticsSource.GSC,
                    clicks,
                    impressions,
                    ctr,
                    avgPosition,
                  },
                });
              }
            }
          }

          // GSC Top Pages
          const gscPagesRes = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(integration.externalSiteIdentifier)}/searchAnalytics/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              startDate: startDateStr,
              endDate: endDateStr,
              dimensions: ['date', 'page'],
              rowLimit: 20,
            }),
          });

          if (gscPagesRes.ok) {
            const gscPagesData = (await gscPagesRes.json()) as any;
            if (gscPagesData.rows) {
              for (const row of gscPagesData.rows) {
                const metricDate = new Date(row.keys[0]);
                const fullPageUrl = row.keys[1] || '/';
                let pagePath = fullPageUrl;
                try {
                  const urlObj = new URL(fullPageUrl);
                  pagePath = urlObj.pathname + urlObj.search;
                } catch {
                  // Fallback
                }

                const clicks = Number(row.clicks || 0);
                const impressions = Number(row.impressions || 0);
                const ctr = Number(row.ctr || 0);
                const avgPosition = Number(row.position || 0);

                await prisma.topPageDaily.deleteMany({
                  where: {
                    siteId: integration.siteId,
                    metricDate,
                    source: AnalyticsSource.GSC,
                    pagePath,
                  },
                });

                await prisma.topPageDaily.create({
                  data: {
                    siteId: integration.siteId,
                    metricDate,
                    source: AnalyticsSource.GSC,
                    pagePath,
                    clicks,
                    impressions,
                    ctr,
                    avgPosition,
                  },
                });
              }
            }
          }
        }
      } catch (err: any) {
        console.error(`[worker] Failed to sync analytics for site ${integration.site.domain}: ${err.message}`);
      }
    }
  } catch (error: any) {
    console.error('[worker] Error running analytics synchronization:', error);
  }
}

// SSL Certificate & Domain Expiry Checker
async function checkSslAndDomainExpiry() {
  console.log('[worker] Starting SSL and Domain Expiry checks...');
  try {
    const sites = await prisma.site.findMany({
      where: { status: 'ACTIVE' },
    });

    for (const site of sites) {
      try {
        console.log(`[worker] [SSL] Checking SSL expiry for domain: ${site.domain}`);
        const sslInfo = await getSslDetails(site.domain);
        const expiresAt = sslInfo.expiresAt;
        const issuer = sslInfo.issuer;
        const now = new Date();
        const diffDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        let sslStatus = 'VALID';
        if (diffDays <= 0) {
          sslStatus = 'EXPIRED';
        } else if (diffDays <= 7) {
          sslStatus = 'CRITICAL';
        } else if (diffDays <= 30) {
          sslStatus = 'EXPIRING_SOON';
        }

        await prisma.siteDiagnostics.upsert({
          where: { siteId: site.id },
          update: {
            sslExpiresAt: expiresAt,
            sslIssuer: issuer,
            sslStatus,
            lastDiagnosticsAt: new Date(),
          },
          create: {
            siteId: site.id,
            sslExpiresAt: expiresAt,
            sslIssuer: issuer,
            sslStatus,
            lastDiagnosticsAt: new Date(),
          },
        });

        if (sslStatus === 'EXPIRED' || sslStatus === 'CRITICAL' || sslStatus === 'EXPIRING_SOON') {
          const severity = sslStatus === 'EXPIRING_SOON' ? 'WARNING' : 'CRITICAL';
          
          const existingIncident = await prisma.incident.findFirst({
            where: { siteId: site.id, status: 'OPEN', incidentType: 'CONNECTION', summary: { startsWith: 'SSL' } },
          });

          if (!existingIncident) {
            const newIncident = await prisma.incident.create({
              data: {
                siteId: site.id,
                incidentType: 'CONNECTION',
                severity,
                startedAt: new Date(),
                status: 'OPEN',
                summary: `SSL Certificate for ${site.domain} is ${sslStatus === 'EXPIRED' ? 'EXPIRED' : 'EXPIRING SOON'} (Days left: ${diffDays})`,
                metadataJson: { expiresAt: expiresAt.toISOString(), diffDays, issuer },
              },
            });
            await dispatchNotifications(newIncident.id, 'INCIDENT_OPENED');
          }
        } else {
          const openSslIncidents = await prisma.incident.findMany({
            where: { siteId: site.id, status: 'OPEN', incidentType: 'CONNECTION', summary: { startsWith: 'SSL' } },
          });

          for (const incident of openSslIncidents) {
            await prisma.incident.update({
              where: { id: incident.id },
              data: {
                status: 'RESOLVED',
                endedAt: new Date(),
                summary: 'SSL Certificate is now valid and healthy.',
              },
            });
            await dispatchNotifications(incident.id, 'INCIDENT_RESOLVED');
          }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown SSL error';
        console.error(`[worker] [SSL] Failed to check SSL for ${site.domain}:`, errMsg);
        
        await prisma.siteDiagnostics.upsert({
          where: { siteId: site.id },
          update: {
            sslStatus: 'ERROR',
            lastDiagnosticsAt: new Date(),
          },
          create: {
            siteId: site.id,
            sslStatus: 'ERROR',
            lastDiagnosticsAt: new Date(),
          },
        });
      }
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown SSL loop error';
    console.error('[worker] [SSL] Error in SSL check worker loop:', errMsg);
  }
}

function getSslDetails(domain: string): Promise<{ expiresAt: Date, issuer: string }> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: domain,
      port: 443,
      servername: domain,
      rejectUnauthorized: false,
    }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (cert && cert.valid_to) {
        const cn = cert.issuer.CN;
        const o = cert.issuer.O;
        const cnStr = Array.isArray(cn) ? cn[0] : cn;
        const oStr = Array.isArray(o) ? o[0] : o;
        resolve({
          expiresAt: new Date(cert.valid_to),
          issuer: cnStr || oStr || 'Unknown',
        });
      } else {
        reject(new Error('Failed to retrieve peer certificate'));
      }
    });

    socket.setTimeout(8000);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('SSL connection timeout'));
    });

    socket.on('error', (err) => {
      reject(err);
    });
  });
}

// Diagnostics & Server resources sync from Agent
async function syncDiagnosticsData() {
  console.log('[worker] Starting Server Diagnostics sync from Agents...');
  try {
    const sites = await prisma.site.findMany({
      where: { status: 'ACTIVE', connectionStatus: 'CONNECTED' },
      include: { credential: true },
    });

    for (const site of sites) {
      if (!site.credential) continue;

      try {
        const secretKey = decrypt(site.credential.secretKeyEncrypted, getEncryptionKey());
        const method = 'POST';
        const path = '/wpcc/v1/execute/diagnostics';
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const bodyObj = {};
        const bodyStr = JSON.stringify(bodyObj);

        const message = `${method}|${path}|${timestamp}|${bodyStr}`;
        const signature = createHmac('sha256', secretKey).update(message).digest('hex');

        const targetUrl = `${site.siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/diagnostics`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(targetUrl, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'x-wpcc-signature': signature,
            'x-wpcc-timestamp': timestamp,
          },
          body: bodyStr,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const json = await response.json() as Record<string, unknown>;
        if (!json.success || !json.data) {
          throw new Error((json.message as string) || 'Agent returned success=false');
        }

        const dataObj = json.data as Record<string, unknown>;
        const disk = dataObj.disk as Record<string, number>;
        const cron = dataObj.cron as Record<string, unknown>;

        const total = disk.total;
        const used = disk.used;
        const percentUsed = total > 0 ? (used / total) * 100 : 0;

        await prisma.siteDiagnostics.upsert({
          where: { siteId: site.id },
          update: {
            diskTotalBytes: total,
            diskUsedBytes: used,
            cronHealthStatus: (cron.health as string) || 'OK',
            cronDetailsJson: (cron.late_jobs as any) || [],
            lastDiagnosticsAt: new Date(),
          },
          create: {
            siteId: site.id,
            diskTotalBytes: total,
            diskUsedBytes: used,
            cronHealthStatus: (cron.health as string) || 'OK',
            cronDetailsJson: (cron.late_jobs as any) || [],
            lastDiagnosticsAt: new Date(),
          },
        });

        if (percentUsed >= 90) {
          const existingIncident = await prisma.incident.findFirst({
            where: { siteId: site.id, status: 'OPEN', incidentType: 'RESPONSE_TIME', summary: { startsWith: 'DISK' } },
          });

          if (!existingIncident) {
            const newIncident = await prisma.incident.create({
              data: {
                siteId: site.id,
                incidentType: 'RESPONSE_TIME',
                severity: 'CRITICAL',
                startedAt: new Date(),
                status: 'OPEN',
                summary: `DISK space critical on ${site.domain}: ${percentUsed.toFixed(1)}% used.`,
                metadataJson: { total, used, percentUsed },
              },
            });
            await dispatchNotifications(newIncident.id, 'INCIDENT_OPENED');
          }
        } else {
          const openDiskIncidents = await prisma.incident.findMany({
            where: { siteId: site.id, status: 'OPEN', incidentType: 'RESPONSE_TIME', summary: { startsWith: 'DISK' } },
          });

          for (const incident of openDiskIncidents) {
            await prisma.incident.update({
              where: { id: incident.id },
              data: {
                status: 'RESOLVED',
                endedAt: new Date(),
                summary: `Disk space usage recovered to safe levels: ${percentUsed.toFixed(1)}%.`,
              },
            });
            await dispatchNotifications(incident.id, 'INCIDENT_RESOLVED');
          }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown diagnostics sync error';
        console.error(`[worker] Failed to sync diagnostics for ${site.domain}:`, errMsg);
      }
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown diagnostics loop error';
    console.error('[worker] Error in syncDiagnosticsData loop:', errMsg);
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

setInterval(() => Promise.resolve().then(() => syncAnalyticsData()), 60 * 60 * 1000); // Sync actual analytics hourly
Promise.resolve().then(() => syncAnalyticsData()); // Run once on startup

// Server Diagnostics sync scheduler (Hourly)
setInterval(() => Promise.resolve().then(() => syncDiagnosticsData()), 60 * 60 * 1000);
Promise.resolve().then(() => syncDiagnosticsData()); // Run once on startup

// SSL Cert expiry scheduler (12 Hours)
setInterval(() => Promise.resolve().then(() => checkSslAndDomainExpiry()), 12 * 60 * 60 * 1000);
Promise.resolve().then(() => checkSslAndDomainExpiry()); // Run once on startup

interface PageSpeedResult {
  performanceScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
}

interface PageSpeedApiResponse {
  lighthouseResult?: {
    categories?: {
      performance?: { score?: number };
      accessibility?: { score?: number };
      'best-practices'?: { score?: number };
      seo?: { score?: number };
    };
    audits?: {
      'largest-contentful-paint'?: { numericValue?: number };
      'interactive'?: { numericValue?: number };
      'cumulative-layout-shift'?: { numericValue?: number };
    };
  };
}

async function fetchPageSpeedMetrics(siteUrl: string): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY || '';
  const keyParam = apiKey ? `&key=${apiKey}` : '';
  const targetUrl = `https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(siteUrl)}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO${keyParam}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000); // 35 seconds timeout

  try {
    const response = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`PageSpeed API returned status ${response.status}`);
    }

    const json = await response.json() as PageSpeedApiResponse;
    const categories = json.lighthouseResult?.categories;
    const audits = json.lighthouseResult?.audits;

    const getScore = (val: number | undefined) => val !== undefined ? Math.round(val * 100) : 0;

    const performanceScore = getScore(categories?.performance?.score);
    const accessibilityScore = getScore(categories?.accessibility?.score);
    const bestPracticesScore = getScore(categories?.['best-practices']?.score);
    const seoScore = getScore(categories?.seo?.score);

    const lcp = audits?.['largest-contentful-paint']?.numericValue ?? null;
    const inp = audits?.['interactive']?.numericValue ?? null;
    const cls = audits?.['cumulative-layout-shift']?.numericValue ?? null;

    return {
      performanceScore,
      accessibilityScore,
      bestPracticesScore,
      seoScore,
      lcpMs: lcp,
      inpMs: inp,
      cls: cls,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : 'Unknown PageSpeed API error';
    throw new Error(`PageSpeed API fetch failed: ${msg}`);
  }
}

async function syncPerformanceData() {
  console.log('[worker] [PageSpeed] Starting periodic performance audits...');
  try {
    const sites = await prisma.site.findMany({
      where: { status: 'ACTIVE' },
    });

    for (const site of sites) {
      console.log(`[worker] [PageSpeed] Auditing performance for ${site.domain}...`);
      try {
        const metrics = await fetchPageSpeedMetrics(site.siteUrl);
        
        await prisma.sitePerformanceAudit.create({
          data: {
            siteId: site.id,
            performanceScore: metrics.performanceScore,
            accessibilityScore: metrics.accessibilityScore,
            bestPracticesScore: metrics.bestPracticesScore,
            seoScore: metrics.seoScore,
            lcpMs: metrics.lcpMs,
            inpMs: metrics.inpMs,
            cls: metrics.cls,
          },
        });
        console.log(`[worker] [PageSpeed] Successfully saved audit for ${site.domain}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[worker] [PageSpeed] Failed to audit ${site.domain}:`, msg);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[worker] [PageSpeed] Error in performance sync loop:', msg);
  }
}

// Daily Performance Audits (24 Hours)
setInterval(() => Promise.resolve().then(() => syncPerformanceData()), 24 * 60 * 60 * 1000);
// Run on startup after 1 minute to avoid overloading startup processes
setTimeout(() => Promise.resolve().then(() => syncPerformanceData()), 60 * 1000);

setInterval(() => tick('dispatch-jobs'), 15 * 1000);

console.log('Worker bootstrap with BullMQ Worker started successfully');
