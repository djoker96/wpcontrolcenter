import { Worker, Job as BullJob } from 'bullmq';
import { PrismaClient, JobStatus, LogLevel, AuditResult, AnalyticsSource } from '@wpcc/database';
import { createDecipheriv, createHmac, createCipheriv, randomBytes } from 'node:crypto';
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

function encrypt(text: string, secretKeyHex: string): string {
  const key = Buffer.from(secretKeyHex, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
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

setInterval(() => tick('dispatch-jobs'), 15 * 1000);

console.log('Worker bootstrap with BullMQ Worker started successfully');
