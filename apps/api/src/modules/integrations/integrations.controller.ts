import { Body, Controller, Get, Post, Param, UseGuards, Query } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@wpcc/database';

@Controller('integrations')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  async findAll() {
    const data = await this.integrationsService.findAll();
    return { data };
  }

  @Post('google/connect')
  connectGoogle() {
    const authorizationUrl = this.integrationsService.getGoogleAuthUrl();
    return { authorizationUrl };
  }

  @Post('google/callback')
  async callback(@Body() body: { code: string }) {
    if (!body.code) {
      return { success: false, error: 'Auth code is required' };
    }
    const result = await this.integrationsService.handleGoogleCallback(body.code);
    return result;
  }

  @Get('google/properties')
  async listProperties(@Query('accountId') accountId: string) {
    if (!accountId) {
      return { success: false, error: 'accountId is required' };
    }
    const result = await this.integrationsService.listGoogleProperties(accountId);
    return result;
  }

  @Post('sites/:siteId/map')
  async mapSite(
    @Param('siteId') siteId: string,
    @Body() body: { accountId: string; ga4PropertyId: string | null; gscSiteIdentifier: string | null },
  ) {
    if (!body.accountId) {
      return { success: false, error: 'accountId is required' };
    }
    const result = await this.integrationsService.mapSiteProperties(
      siteId,
      body.accountId,
      body.ga4PropertyId,
      body.gscSiteIdentifier,
    );
    return result;
  }
}
