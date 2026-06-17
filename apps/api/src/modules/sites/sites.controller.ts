import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@wpcc/database';

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
  resync(@Param('id') id: string) {
    return { siteId: id, jobId: 'job_resync_stub' };
  }

  @Get(':id/overview')
  @Roles(UserRole.ADMIN)
  overview(@Param('id') id: string) {
    return { siteId: id, summary: { pendingUpdates: 3, isUp: true } };
  }

  @Get(':id/plugins')
  @Roles(UserRole.ADMIN)
  plugins(@Param('id') id: string) {
    return { siteId: id, data: [] };
  }

  @Get(':id/themes')
  @Roles(UserRole.ADMIN)
  themes(@Param('id') id: string) {
    return { siteId: id, data: [] };
  }

  @Get(':id/core')
  @Roles(UserRole.ADMIN)
  core(@Param('id') id: string) {
    return { siteId: id, versionInstalled: '6.5.5' };
  }

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

  @Get(':id/analytics')
  @Roles(UserRole.ADMIN)
  analytics(@Param('id') id: string) {
    return { siteId: id, summary: {} };
  }

  @Get(':id/audit-logs')
  @Roles(UserRole.ADMIN)
  auditLogs(@Param('id') id: string) {
    return { siteId: id, data: [] };
  }

  @Post(':id/actions/:action')
  @Roles(UserRole.ADMIN)
  executeAction(@Param('id') id: string, @Param('action') action: string, @Body() body: Record<string, unknown>) {
    return { siteId: id, action, jobId: `job_${action}`, payload: body };
  }

  @Post(':id/integrations/:provider')
  @Roles(UserRole.ADMIN)
  attachIntegration(@Param('id') id: string, @Param('provider') provider: string, @Body() body: Record<string, unknown>) {
    return { siteId: id, provider, ...body };
  }
}
