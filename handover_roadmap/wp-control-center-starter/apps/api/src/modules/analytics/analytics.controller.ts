import { Controller, Get, Param } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  overview() { return this.analyticsService.overview(); }

  @Get('sites/:id/ga4')
  ga4(@Param('id') id: string) { return { siteId: id, source: 'GA4', data: [] }; }

  @Get('sites/:id/gsc')
  gsc(@Param('id') id: string) { return { siteId: id, source: 'GSC', data: [] }; }
}
