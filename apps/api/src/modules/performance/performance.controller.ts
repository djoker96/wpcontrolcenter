import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@wpcc/database';

@Controller('sites')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATOR)
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get(':id/performance')
  async getPerformance(@Param('id') siteId: string) {
    return this.performanceService.getPerformanceHistory(siteId);
  }

  @Post(':id/performance/refresh')
  async runPerformanceTest(@Param('id') siteId: string) {
    const data = await this.performanceService.triggerManualAudit(siteId);
    return { success: true, data };
  }
}
