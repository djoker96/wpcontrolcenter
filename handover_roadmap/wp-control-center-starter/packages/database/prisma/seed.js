"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const prisma = new client_1.PrismaClient();
function fakeEncrypt(value) {
    return `enc:${Buffer.from(value, 'utf8').toString('base64')}`;
}
function hashPassword(password) {
    return (0, node_crypto_1.createHash)('sha256').update(password).digest('hex');
}
async function main() {
    const admin = await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {},
        create: {
            email: 'admin@example.com',
            passwordHash: hashPassword('ChangeMe123!'),
            fullName: 'System Administrator',
            role: client_1.UserRole.SUPER_ADMIN,
        },
    });
    const googleAccount = await prisma.integrationAccount.create({
        data: {
            provider: client_1.IntegrationProvider.GOOGLE,
            accountEmail: 'analytics@example.com',
            accessTokenEncrypted: fakeEncrypt('google-access-token'),
            refreshTokenEncrypted: fakeEncrypt('google-refresh-token'),
            status: client_1.IntegrationStatus.ACTIVE,
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
            environment: client_1.EnvironmentType.PRODUCTION,
            wpVersion: '6.5.5',
            phpVersion: '8.2',
            wpAgentVersion: '0.1.0',
            timezone: 'Asia/Bangkok',
            status: client_1.SiteStatus.ACTIVE,
            connectionStatus: client_1.ConnectionStatus.CONNECTED,
            ga4PropertyId: 'properties/123456789',
            gscSiteUrl: 'sc-domain:example.com',
            notes: 'Seeded demo site',
            lastSeenAt: new Date(),
            credential: {
                create: {
                    publicKey: 'demo-public-key',
                    secretKeyEncrypted: fakeEncrypt('demo-secret-key'),
                    connectionTokenEncrypted: fakeEncrypt('demo-connection-token'),
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
                    provider: client_1.IntegrationProvider.GOOGLE,
                    externalPropertyId: 'properties/123456789',
                    externalSiteIdentifier: 'sc-domain:example.com',
                    status: client_1.IntegrationStatus.ACTIVE,
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
            jobType: client_1.JobType.UPDATE_PLUGIN,
            targetType: client_1.JobTargetType.PLUGIN,
            targetSlug: 'elementor/elementor.php',
            payloadJson: { slug: 'elementor/elementor.php' },
            status: client_1.JobStatus.SUCCESS,
            initiatedByUserId: admin.id,
            queuedAt: new Date(),
            startedAt: new Date(),
            endedAt: new Date(),
            resultJson: { previousVersion: '3.21.0', newVersion: '3.22.0' },
        },
    });
    await prisma.jobLog.createMany({
        data: [
            { jobId: job.id, level: client_1.LogLevel.INFO, message: 'Job queued' },
            { jobId: job.id, level: client_1.LogLevel.INFO, message: 'Plugin update completed' },
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
            incidentType: client_1.IncidentType.RESPONSE_TIME,
            severity: client_1.IncidentSeverity.WARNING,
            status: client_1.IncidentStatus.RESOLVED,
            startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            endedAt: new Date(Date.now() - 90 * 60 * 1000),
            summary: 'Temporary response time spike detected',
            metadataJson: { p95: 2400 },
        },
    });
    await prisma.analyticsDaily.createMany({
        data: [
            { siteId: site.id, metricDate: new Date('2026-06-14'), source: client_1.AnalyticsSource.GA4, sessions: 120, users: 90, pageviews: 310 },
            { siteId: site.id, metricDate: new Date('2026-06-15'), source: client_1.AnalyticsSource.GA4, sessions: 142, users: 101, pageviews: 352 },
            { siteId: site.id, metricDate: new Date('2026-06-16'), source: client_1.AnalyticsSource.GA4, sessions: 155, users: 110, pageviews: 398 },
            { siteId: site.id, metricDate: new Date('2026-06-16'), source: client_1.AnalyticsSource.GSC, impressions: 3400, clicks: 128, ctr: 3.76, avgPosition: 13.2 },
        ],
        skipDuplicates: true,
    });
    await prisma.topPageDaily.createMany({
        data: [
            { siteId: site.id, metricDate: new Date('2026-06-16'), source: client_1.AnalyticsSource.GA4, pagePath: '/', pageTitle: 'Home', sessions: 70, pageviews: 120 },
            { siteId: site.id, metricDate: new Date('2026-06-16'), source: client_1.AnalyticsSource.GSC, pagePath: '/seo-audit', pageTitle: 'SEO Audit', impressions: 740, clicks: 28, ctr: 3.78, avgPosition: 11.4 },
        ],
    });
    const notification = await prisma.notification.create({
        data: {
            channelType: client_1.NotificationChannelType.EMAIL,
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
            channelType: client_1.NotificationChannelType.EMAIL,
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
                result: client_1.AuditResult.SUCCESS,
                payloadJson: { domain: site.domain },
            },
            {
                userId: admin.id,
                siteId: site.id,
                action: 'plugin.update',
                entityType: 'plugin',
                entityId: site.plugins[0]?.id,
                result: client_1.AuditResult.SUCCESS,
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
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
