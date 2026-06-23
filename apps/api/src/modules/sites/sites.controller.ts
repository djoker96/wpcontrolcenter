import { Body, Controller, Delete, Get, Param, Patch, Post, ParseEnumPipe, UseGuards } from '@nestjs/common';
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { AttachIntegrationDto } from './dto/attach-integration.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, IntegrationProvider } from '@wpcc/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('sites')
@UseGuards(AuthGuard, RolesGuard)
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  async findAll() {
    const data = await this.sitesService.findAll();
    return { data };
  }

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() createSiteDto: CreateSiteDto) {
    return this.sitesService.create(createSiteDto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  async findOne(@Param('id') id: string) {
    return this.sitesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(@Param('id') id: string, @Body() updateSiteDto: UpdateSiteDto) {
    return this.sitesService.update(id, updateSiteDto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async remove(@Param('id') id: string) {
    const deleted = await this.sitesService.remove(id);
    return { success: true, id: deleted.id };
  }

  @Post(':id/generate-connection-token')
  @Roles(UserRole.ADMIN)
  async generateConnectionToken(@Param('id') id: string) {
    return this.sitesService.generateConnectionToken(id);
  }

  @Post(':id/rotate-secret')
  @Roles(UserRole.ADMIN)
  async rotateSecret(@Param('id') id: string) {
    return this.sitesService.rotateSecret(id);
  }

  @Post(':id/resync')
  @Roles(UserRole.ADMIN)
  async resync(@Param('id') id: string) {
    return this.sitesService.resync(id);
  }

  @Get(':id/overview')
  @Roles(UserRole.ADMIN)
  async overview(@Param('id') id: string) {
    const site = await this.sitesService.findOne(id);
    const [pluginsCount, activePluginsCount, pluginUpdatesAvailable] = await Promise.all([
      this.sitesService.prisma.plugin.count({ where: { siteId: id } }),
      this.sitesService.prisma.plugin.count({ where: { siteId: id, isActive: true } }),
      this.sitesService.prisma.plugin.count({ where: { siteId: id, updateAvailable: true } }),
    ]);

    const [themesCount, activeThemeName, themeUpdatesAvailable] = await Promise.all([
      this.sitesService.prisma.theme.count({ where: { siteId: id } }),
      this.sitesService.prisma.theme.findFirst({ where: { siteId: id, isActive: true } }).then(t => t?.name || 'None'),
      this.sitesService.prisma.theme.count({ where: { siteId: id, updateAvailable: true } }),
    ]);

    return {
      siteId: id,
      summary: {
        name: site.name,
        domain: site.domain,
        siteUrl: site.siteUrl,
        connectionStatus: site.connectionStatus,
        lastSeenAt: site.lastSeenAt,
        wpVersion: site.wpVersion,
        phpVersion: site.phpVersion,
        wpAgentVersion: site.wpAgentVersion,
        timezone: site.timezone,
        pluginsCount,
        activePluginsCount,
        pluginUpdatesAvailable,
        themesCount,
        activeThemeName,
        themeUpdatesAvailable,
        coreUpdateAvailable: site.coreVersion?.updateAvailable || false,
        coreVersionLatest: site.coreVersion?.versionLatest || null,
        ga4PropertyId: site.ga4PropertyId,
        gscSiteUrl: site.gscSiteUrl,
      },
    };
  }

  @Get(':id/plugins')
  @Roles(UserRole.ADMIN)
  async plugins(@Param('id') id: string) {
    const data = await this.sitesService.prisma.plugin.findMany({
      where: { siteId: id },
      orderBy: { name: 'asc' },
    });
    return { siteId: id, data };
  }

  @Get(':id/themes')
  @Roles(UserRole.ADMIN)
  async themes(@Param('id') id: string) {
    const data = await this.sitesService.prisma.theme.findMany({
      where: { siteId: id },
      orderBy: { name: 'asc' },
    });
    return { siteId: id, data };
  }

  @Get(':id/core')
  @Roles(UserRole.ADMIN)
  async core(@Param('id') id: string) {
    const data = await this.sitesService.prisma.coreVersion.findUnique({
      where: { siteId: id },
    });
    return data || { versionInstalled: 'Unknown', updateAvailable: false };
  }

  @Get(':id/uptime')
  @Roles(UserRole.ADMIN)
  async uptime(@Param('id') id: string) {
    const checks = await this.sitesService.prisma.uptimeCheck.findMany({
      where: { siteId: id },
      orderBy: { checkedAt: 'desc' },
      take: 50,
    });

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

  @Get(':id/analytics')
  @Roles(UserRole.ADMIN)
  analytics(@Param('id') id: string) {
    return { siteId: id, summary: {} };
  }

  @Get(':id/audit-logs')
  @Roles(UserRole.ADMIN)
  async auditLogs(@Param('id') id: string) {
    const data = await this.sitesService.prisma.auditLog.findMany({
      where: { siteId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
    return { siteId: id, data };
  }

  @Post(':id/actions/:action')
  @Roles(UserRole.ADMIN)
  executeAction(
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: Record<string, any>,
    @CurrentUser() user: any
  ) {
    return this.sitesService.createJob(id, action, body, user?.id);
  }

  @Post(':id/integrations/:provider')
  @Roles(UserRole.ADMIN)
  async attachIntegration(
    @Param('id') id: string,
    @Param('provider', new ParseEnumPipe(IntegrationProvider)) provider: IntegrationProvider,
    @Body() body: AttachIntegrationDto,
  ) {
    return this.sitesService.attachIntegration(id, provider, body.integrationAccountId, body.externalPropertyId);
  }
}
