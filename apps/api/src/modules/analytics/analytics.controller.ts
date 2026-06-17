import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@wpcc/database';

@Controller('analytics')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async overview() {
    const data = await this.analyticsService.overview();
    return data;
  }

  @Get('sites/:id')
  async getSiteAnalytics(
    @Param('id') id: string,
    @Query('range') range?: string,
  ) {
    const rangeDays = range ? Number(range) : 30;
    const result = await this.analyticsService.getSiteAnalytics(id, rangeDays);
    return result;
  }

  @Get('sites/:id/ga4')
  async ga4(
    @Param('id') id: string,
    @Query('range') range?: string,
  ) {
    const rangeDays = range ? Number(range) : 30;
    const result = await this.analyticsService.getSiteAnalytics(id, rangeDays);
    return { siteId: id, source: 'GA4', data: result.ga4Data };
  }

  @Get('sites/:id/gsc')
  async gsc(
    @Param('id') id: string,
    @Query('range') range?: string,
  ) {
    const rangeDays = range ? Number(range) : 30;
    const result = await this.analyticsService.getSiteAnalytics(id, rangeDays);
    return { siteId: id, source: 'GSC', data: result.gscData };
  }
}
