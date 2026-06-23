import { PrismaClient, UserRole, EnvironmentType, ConnectionStatus, SiteStatus, JobStatus, JobType, JobTargetType, IncidentSeverity, IncidentStatus, IncidentType, NotificationChannelType, AnalyticsSource, AuditResult, LogLevel, IntegrationProvider, IntegrationStatus } from '@prisma/client';
import { scryptSync, createCipheriv, randomBytes } from 'node:crypto';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();
const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string, secretKeyHex: string): string {
  const key = Buffer.from(secretKeyHex, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required for seeding encrypted fields`);
  }
  return value;
}

const encKey = getRequiredEnv('AGENT_ENCRYPTION_KEY');

function encryptValue(value: string): string {
  return encrypt(value, encKey);
}

function hashPassword(password: string): string {
  // Use scrypt (same algorithm as crypto.utils.ts) instead of SHA-256
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Resolve the seed admin password.
 * - If SEED_ADMIN_PASSWORD is set, use it (useful for CI / repeatable deploys).
 * - Otherwise generate a strong random password and print it once so the
 *   operator can capture it from the deploy logs. This avoids shipping a
 *   known default credential ("ChangeMe123!") to production.
 */
function resolveSeedPassword(): { password: string; generated: boolean } {
  const fromEnv = process.env.SEED_ADMIN_PASSWORD;
  if (fromEnv && fromEnv.length >= 12) {
    return { password: fromEnv, generated: false };
  }
  return { password: randomBytes(18).toString('base64url'), generated: true };
}

let seededAdminPassword: { password: string; generated: boolean } | null = null;

async function main(): Promise<void> {
  seededAdminPassword = resolveSeedPassword();
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      passwordHash: hashPassword(seededAdminPassword.password),
      role: UserRole.SUPER_ADMIN,
    },
    create: {
      email: 'admin@example.com',
      passwordHash: hashPassword(seededAdminPassword.password),
      fullName: 'System Administrator',
      role: UserRole.SUPER_ADMIN,
    },
  });

  const googleAccount = await prisma.integrationAccount.create({
    data: {
      provider: IntegrationProvider.GOOGLE,
      accountEmail: 'analytics@example.com',
      accessTokenEncrypted: encryptValue('google-access-token'),
      refreshTokenEncrypted: encryptValue('google-refresh-token'),
      status: IntegrationStatus.ACTIVE,
      metadataJson: {
        scopes: ['https://www.googleapis.com/auth/analytics.readonly', 'https://www.googleapis.com/auth/webmasters.readonly'],
      },
    },
  });

  const site = await prisma.site.upsert({
    where: { domain: 'demo.example.com' },
    update: {},
    create: {
      name: 'Demo Site',
      domain: 'demo.example.com',
      siteUrl: 'https://demo.example.com',
      environment: EnvironmentType.PRODUCTION,
      wpVersion: '6.5.5',
      phpVersion: '8.2',
      wpAgentVersion: '0.1.0',
      timezone: 'Asia/Bangkok',
      status: SiteStatus.ACTIVE,
      connectionStatus: ConnectionStatus.CONNECTED,
      ga4PropertyId: 'properties/123456789',
      gscSiteUrl: 'sc-domain:example.com',
      notes: 'Seeded demo site',
      lastSeenAt: new Date(),
      credential: {
        create: {
          publicKey: 'demo-public-key',
          secretKeyEncrypted: encryptValue('demo-secret-key'),
          connectionTokenEncrypted: encryptValue('demo-connection-token'),
          lastRotatedAt: new Date(),
        },
      },
      setting: {
        create: {
          heartbeatIntervalMinutes: 5,
          uptimeCheckEnabled: true,
          analyticsSyncEnabled: true,
          updateWindowStart: '01:00',
          updateWindowEnd: '04:00',
          allowPluginInstall: true,
          allowPluginDelete: true,
          allowThemeDelete: true,
          allowFileEdit: true,
        },
      },
      coreVersion: {
        create: {
          versionInstalled: '6.5.5',
          versionLatest: '6.6.0',
          updateAvailable: true,
          lastSyncedAt: new Date(),
        },
      },
      plugins: {
        create: [
          {
            slug: 'elementor/elementor.php',
            name: 'Elementor',
            versionInstalled: '3.21.0',
            versionLatest: '3.22.0',
            isActive: true,
            updateAvailable: true,
            sourceType: 'wordpress_org',
            installedAt: new Date(),
            lastSyncedAt: new Date(),
          },
          {
            slug: 'wordpress-seo/wp-seo.php',
            name: 'Yoast SEO',
            versionInstalled: '23.0',
            versionLatest: '23.1',
            isActive: true,
            updateAvailable: true,
            sourceType: 'wordpress_org',
            installedAt: new Date(),
            lastSyncedAt: new Date(),
          },
        ],
      },
      themes: {
        create: [
          {
            slug: 'astra',
            name: 'Astra',
            versionInstalled: '4.7.0',
            versionLatest: '4.8.0',
            isActive: true,
            updateAvailable: true,
            lastSyncedAt: new Date(),
          },
        ],
      },
      integrations: {
        create: {
          integrationAccountId: googleAccount.id,
          provider: IntegrationProvider.GOOGLE,
          externalPropertyId: 'properties/123456789',
          externalSiteIdentifier: 'sc-domain:example.com',
          status: IntegrationStatus.ACTIVE,
        },
      },
    },
    include: {
      plugins: true,
      themes: true,
      coreVersion: true,
    },
  });

  const job = await prisma.job.create({
    data: {
      siteId: site.id,
      jobType: JobType.UPDATE_PLUGIN,
      targetType: JobTargetType.PLUGIN,
      targetSlug: 'elementor/elementor.php',
      payloadJson: { slug: 'elementor/elementor.php' },
      status: JobStatus.SUCCESS,
      initiatedByUserId: admin.id,
      queuedAt: new Date(),
      startedAt: new Date(),
      endedAt: new Date(),
      resultJson: { previousVersion: '3.21.0', newVersion: '3.22.0' },
    },
  });

  await prisma.jobLog.createMany({
    data: [
      { jobId: job.id, level: LogLevel.INFO, message: 'Job queued' },
      { jobId: job.id, level: LogLevel.INFO, message: 'Plugin update completed' },
    ],
  });

  await prisma.uptimeCheck.createMany({
    data: [
      { siteId: site.id, checkedAt: new Date(Date.now() - 10 * 60 * 1000), statusCode: 200, responseTimeMs: 490, isUp: true },
      { siteId: site.id, checkedAt: new Date(Date.now() - 5 * 60 * 1000), statusCode: 200, responseTimeMs: 420, isUp: true },
      { siteId: site.id, checkedAt: new Date(), statusCode: 200, responseTimeMs: 405, isUp: true },
    ],
    skipDuplicates: true,
  });

  const incident = await prisma.incident.create({
    data: {
      siteId: site.id,
      incidentType: IncidentType.RESPONSE_TIME,
      severity: IncidentSeverity.WARNING,
      status: IncidentStatus.RESOLVED,
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 90 * 60 * 1000),
      summary: 'Temporary response time spike detected',
      metadataJson: { p95: 2400 },
    },
  });

  await prisma.analyticsDaily.createMany({
    data: [
      { siteId: site.id, metricDate: new Date('2026-06-14'), source: AnalyticsSource.GA4, sessions: 120, users: 90, pageviews: 310 },
      { siteId: site.id, metricDate: new Date('2026-06-15'), source: AnalyticsSource.GA4, sessions: 142, users: 101, pageviews: 352 },
      { siteId: site.id, metricDate: new Date('2026-06-16'), source: AnalyticsSource.GA4, sessions: 155, users: 110, pageviews: 398 },
      { siteId: site.id, metricDate: new Date('2026-06-16'), source: AnalyticsSource.GSC, impressions: 3400, clicks: 128, ctr: 3.76, avgPosition: 13.2 },
    ],
    skipDuplicates: true,
  });

  await prisma.topPageDaily.createMany({
    data: [
      { siteId: site.id, metricDate: new Date('2026-06-16'), source: AnalyticsSource.GA4, pagePath: '/', pageTitle: 'Home', sessions: 70, pageviews: 120 },
      { siteId: site.id, metricDate: new Date('2026-06-16'), source: AnalyticsSource.GSC, pagePath: '/seo-audit', pageTitle: 'SEO Audit', impressions: 740, clicks: 28, ctr: 3.78, avgPosition: 11.4 },
    ],
  });

  const notification = await prisma.notification.create({
    data: {
      channelType: NotificationChannelType.EMAIL,
      destination: 'ops@example.com',
      isEnabled: true,
    },
  });

  await prisma.notificationEvent.create({
    data: {
      siteId: site.id,
      incidentId: incident.id,
      notificationId: notification.id,
      eventType: 'incident.resolved',
      channelType: NotificationChannelType.EMAIL,
      destination: 'ops@example.com',
      status: 'SENT',
      payloadJson: { subject: 'Incident resolved' },
      sentAt: new Date(),
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        userId: admin.id,
        siteId: site.id,
        action: 'site.create',
        entityType: 'site',
        entityId: site.id,
        result: AuditResult.SUCCESS,
        payloadJson: { domain: site.domain },
      },
      {
        userId: admin.id,
        siteId: site.id,
        action: 'plugin.update',
        entityType: 'plugin',
        entityId: site.plugins[0]?.id,
        result: AuditResult.SUCCESS,
        payloadJson: { slug: 'elementor/elementor.php' },
      },
    ],
  });

  await prisma.maintenanceSnapshot.create({
    data: {
      siteId: site.id,
      robotsTxtContent: 'User-agent: *\nDisallow:',
      htaccessContent: 'RewriteEngine On',
      phpIniContent: 'memory_limit=256M',
      createdByUserId: admin.id,
    },
  });

  console.log(`Seed completed. Admin: ${admin.email}, Site: ${site.domain}`);
  if (seededAdminPassword?.generated) {
    console.log('');
    console.log('========================================================');
    console.log('  GENERATED ADMIN PASSWORD (save this now, shown once):');
    console.log(`  ${seededAdminPassword.password}`);
    console.log('========================================================');
    console.log('  Set SEED_ADMIN_PASSWORD in the environment to make this');
    console.log('  deterministic, or change it immediately after first login.');
    console.log('========================================================');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
