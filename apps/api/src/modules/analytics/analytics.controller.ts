import { Controller, Get, Param, UseGuards } from '@nestjs/common';
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
  overview() { return this.analyticsService.overview(); }

  @Get('sites/:id/ga4')
  ga4(@Param('id') id: string) { return { siteId: id, source: 'GA4', data: [] }; }

  @Get('sites/:id/gsc')
  gsc(@Param('id') id: string) { return { siteId: id, source: 'GSC', data: [] }; }
}
