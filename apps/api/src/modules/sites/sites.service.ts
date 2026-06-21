import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { encrypt, decrypt } from '../../common/utils/crypto.utils';
import { randomBytes, createHmac } from 'node:crypto';
import { Queue } from 'bullmq';
import { JobType, JobTargetType } from '@wpcc/database';
import { getAgentEncryptionKey } from '../../config/env';

@Injectable()
export class SitesService {
  constructor(
    public readonly prisma: PrismaService,
    @Inject('JOBS_QUEUE') private readonly jobsQueue: Queue,
  ) {}

  async create(createSiteDto: CreateSiteDto) {
    const connectionToken = `wpcc_tok_${randomBytes(16).toString('hex')}`;
    const publicKey = `pub_${randomBytes(12).toString('hex')}`;
    const secretKey = randomBytes(16).toString('hex');

    const encKey = getAgentEncryptionKey();
    const connectionTokenEncrypted = encrypt(connectionToken, encKey);
    const secretKeyEncrypted = encrypt(secretKey, encKey);

    const site = await this.prisma.site.create({
      data: {
        name: createSiteDto.name,
        domain: createSiteDto.domain,
        siteUrl: createSiteDto.siteUrl,
        environment: createSiteDto.environment,
        credential: {
          create: {
            publicKey,
            secretKeyEncrypted,
            connectionTokenEncrypted,
          },
        },
        setting: {
          create: {
            heartbeatIntervalMinutes: 5,
            uptimeCheckEnabled: true,
            analyticsSyncEnabled: true,
            allowPluginInstall: true,
            allowPluginDelete: true,
            allowThemeDelete: true,
            allowFileEdit: true,
          },
        },
      },
      include: {
        setting: true,
      },
    });

    return {
      ...site,
      connectionToken,
    };
  }

  async findAll() {
    return this.prisma.site.findMany({
      include: {
        setting: true,
        coreVersion: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: {
        setting: true,
        coreVersion: true,
        plugins: true,
        themes: true,
        uptimeChecks: {
          orderBy: { checkedAt: 'desc' },
          take: 20,
        },
        incidents: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!site) {
      throw new NotFoundException(`Site with ID ${id} not found`);
    }

    return site;
  }

  async update(id: string, updateSiteDto: UpdateSiteDto) {
    await this.findOne(id);
    
    return this.prisma.site.update({
      where: { id },
      data: {
        name: updateSiteDto.name,
        domain: updateSiteDto.domain,
        siteUrl: updateSiteDto.siteUrl,
        environment: updateSiteDto.environment,
        status: updateSiteDto.status,
      },
      include: {
        setting: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.site.delete({
      where: { id },
    });
  }

  async generateConnectionToken(id: string) {
    await this.findOne(id);
    const connectionToken = `wpcc_tok_${randomBytes(16).toString('hex')}`;
    const encKey = getAgentEncryptionKey();
    const connectionTokenEncrypted = encrypt(connectionToken, encKey);

    await this.prisma.siteCredential.update({
      where: { siteId: id },
      data: {
        connectionTokenEncrypted,
      },
    });

    return {
      siteId: id,
      connectionToken,
    };
  }

  async rotateSecret(id: string) {
    await this.findOne(id);
    const publicKey = `pub_${randomBytes(12).toString('hex')}`;
    const secretKey = randomBytes(16).toString('hex');
    const encKey = getAgentEncryptionKey();
    const secretKeyEncrypted = encrypt(secretKey, encKey);

    await this.prisma.siteCredential.update({
      where: { siteId: id },
      data: {
        publicKey,
        secretKeyEncrypted,
        lastRotatedAt: new Date(),
      },
    });

    return {
      siteId: id,
      publicKey,
      secretKey,
    };
  }

  async resync(id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: { credential: true },
    });

    if (!site) {
      throw new NotFoundException(`Site with ID ${id} not found`);
    }

    if (site.connectionStatus !== 'CONNECTED' || !site.credential) {
      throw new BadRequestException('Site is not connected or missing credentials');
    }

    const secretKey = decrypt(site.credential.secretKeyEncrypted, getAgentEncryptionKey());
    const method = 'POST';
    const path = '/wpcc/v1/execute/sync-inventory';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyObj = {};
    const bodyStr = JSON.stringify(bodyObj);

    // Create signature
    const message = `${method}|${path}|${timestamp}|${bodyStr}`;
    const signature = createHmac('sha256', secretKey).update(message).digest('hex');

    // Call WordPress Agent
    const targetUrl = `${site.siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/sync-inventory`;
    
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
        throw new Error(`Agent returned status ${response.status}`);
      }

      const responseBody = await response.json() as any;
      if (!responseBody || typeof responseBody !== 'object') {
        throw new Error('Invalid agent response: not an object');
      }
      if (!responseBody.success || !responseBody.data) {
        throw new Error(responseBody.message || 'Agent sync failed');
      }

      const { systemInfo, plugins, themes, core } = responseBody.data;

      // Validate schema strictly to prevent malformed data from corrupting DB
      if (!systemInfo || typeof systemInfo !== 'object') {
        throw new Error('Invalid agent response: systemInfo is missing or not an object');
      }
      if (typeof systemInfo.wpVersion !== 'string' ||
          typeof systemInfo.phpVersion !== 'string' ||
          typeof systemInfo.wpAgentVersion !== 'string') {
        throw new Error('Invalid agent response: systemInfo fields must be strings');
      }
      if (!Array.isArray(plugins)) {
        throw new Error('Invalid agent response: plugins must be an array');
      }
      if (!Array.isArray(themes)) {
        throw new Error('Invalid agent response: themes must be an array');
      }
      if (!core || typeof core !== 'object') {
        throw new Error('Invalid agent response: core is missing or not an object');
      }

      // Validate each plugin entry has required fields
      for (const p of plugins) {
        if (!p || typeof p.slug !== 'string' || typeof p.name !== 'string') {
          throw new Error('Invalid agent response: plugin entry missing slug/name');
        }
      }
      // Validate each theme entry has required fields
      for (const t of themes) {
        if (!t || typeof t.slug !== 'string' || typeof t.name !== 'string') {
          throw new Error('Invalid agent response: theme entry missing slug/name');
        }
      }

      // Update Site Table
      await this.prisma.site.update({
        where: { id },
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
        await this.prisma.plugin.upsert({
          where: {
            siteId_slug: {
              siteId: id,
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
            siteId: id,
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
      // Delete uninstalled plugins
      await this.prisma.plugin.deleteMany({
        where: {
          siteId: id,
          slug: { notIn: activeSlugs },
        },
      });

      // Upsert themes
      const activeThemeSlugs = themes.map((t: any) => t.slug);
      for (const theme of themes) {
        await this.prisma.theme.upsert({
          where: {
            siteId_slug: {
              siteId: id,
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
            siteId: id,
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
      // Delete uninstalled themes
      await this.prisma.theme.deleteMany({
        where: {
          siteId: id,
          slug: { notIn: activeThemeSlugs },
        },
      });

      // Upsert core version
      await this.prisma.coreVersion.upsert({
        where: { siteId: id },
        update: {
          versionInstalled: core.versionInstalled,
          versionLatest: core.versionLatest,
          updateAvailable: core.updateAvailable,
          lastSyncedAt: new Date(),
        },
        create: {
          siteId: id,
          versionInstalled: core.versionInstalled,
          versionLatest: core.versionLatest,
          updateAvailable: core.updateAvailable,
          lastSyncedAt: new Date(),
        },
      });

      // Log success audit event
      await this.prisma.auditLog.create({
        data: {
          siteId: id,
          action: 'site.resync',
          entityType: 'site',
          entityId: id,
          result: 'SUCCESS',
        },
      });

      return { success: true };
    } catch (error) {
      await this.prisma.auditLog.create({
        data: {
          siteId: id,
          action: 'site.resync',
          entityType: 'site',
          entityId: id,
          result: 'FAILURE',
          payloadJson: { error: error.message },
        },
      });
      throw error;
    }
  }

  async createJob(siteId: string, action: string, body: Record<string, any>, initiatedByUserId?: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw new NotFoundException(`Site with ID ${siteId} not found`);
    }

    let jobType: JobType;
    let targetType: JobTargetType;
    let targetSlug: string | null = null;

    switch (action) {
      case 'update-plugin':
        jobType = JobType.UPDATE_PLUGIN;
        targetType = JobTargetType.PLUGIN;
        targetSlug = body.slug || null;
        if (!targetSlug) {
          throw new BadRequestException('Plugin slug is required');
        }
        break;
      case 'activate-plugin':
        jobType = JobType.ACTIVATE_PLUGIN;
        targetType = JobTargetType.PLUGIN;
        targetSlug = body.slug || null;
        if (!targetSlug) {
          throw new BadRequestException('Plugin slug is required');
        }
        break;
      case 'deactivate-plugin':
        jobType = JobType.DEACTIVATE_PLUGIN;
        targetType = JobTargetType.PLUGIN;
        targetSlug = body.slug || null;
        if (!targetSlug) {
          throw new BadRequestException('Plugin slug is required');
        }
        break;
      case 'delete-plugin':
        jobType = JobType.DELETE_PLUGIN;
        targetType = JobTargetType.PLUGIN;
        targetSlug = body.slug || null;
        if (!targetSlug) {
          throw new BadRequestException('Plugin slug is required');
        }
        break;
      case 'update-theme':
        jobType = JobType.UPDATE_THEME;
        targetType = JobTargetType.THEME;
        targetSlug = body.slug || null;
        if (!targetSlug) {
          throw new BadRequestException('Theme slug is required');
        }
        break;
      case 'delete-theme':
        jobType = JobType.DELETE_THEME;
        targetType = JobTargetType.THEME;
        targetSlug = body.slug || null;
        if (!targetSlug) {
          throw new BadRequestException('Theme slug is required');
        }
        break;
      case 'update-core':
        jobType = JobType.UPDATE_CORE;
        targetType = JobTargetType.CORE;
        break;
      case 'toggle-maintenance':
        jobType = JobType.TOGGLE_MAINTENANCE;
        targetType = JobTargetType.SITE;
        if (body.enabled === undefined) {
          throw new BadRequestException('Maintenance status (enabled) is required');
        }
        break;
      case 'install-plugin':
        jobType = JobType.INSTALL_PLUGIN;
        targetType = JobTargetType.PLUGIN;
        targetSlug = body.slug || null;
        if (!targetSlug) {
          throw new BadRequestException('Plugin slug is required');
        }
        break;
      case 'clear-cache':
        jobType = JobType.CLEAR_CACHE;
        targetType = JobTargetType.CACHE;
        break;
      case 'optimize-database':
        jobType = JobType.OPTIMIZE_DATABASE;
        targetType = JobTargetType.DATABASE;
        break;
      case 'update-robots-txt':
        jobType = JobType.UPDATE_ROBOTS_TXT;
        targetType = JobTargetType.CONFIG;
        if (body.content === undefined) {
          throw new BadRequestException('Robots.txt content is required');
        }
        break;
      case 'update-htaccess':
        jobType = JobType.UPDATE_HTACCESS;
        targetType = JobTargetType.CONFIG;
        if (body.content === undefined) {
          throw new BadRequestException('.htaccess content is required');
        }
        break;
      case 'update-php-config':
        jobType = JobType.UPDATE_PHP_CONFIG;
        targetType = JobTargetType.CONFIG;
        if (!body.settings || typeof body.settings !== 'object') {
          throw new BadRequestException('PHP settings object is required');
        }
        break;
      default:
        throw new BadRequestException(`Unknown action: ${action}`);
    }

    const job = await this.prisma.job.create({
      data: {
        siteId,
        jobType,
        targetType,
        targetSlug,
        payloadJson: body || {},
        status: 'QUEUED',
        initiatedByUserId,
        queuedAt: new Date(),
      },
    });

    // Enqueue job in BullMQ
    await this.jobsQueue.add(
      'remote-action',
      { jobId: job.id },
      { jobId: job.id }
    );

    return {
      success: true,
      jobId: job.id,
      status: job.status,
    };
  }
}
