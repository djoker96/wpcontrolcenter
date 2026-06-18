import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { DiagnosticsService } from './diagnostics.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@wpcc/database';
import { GetLogsQueryDto } from './dto/get-logs-query.dto';

@Controller('sites')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATOR)
export class DiagnosticsController {
  constructor(private readonly diagnosticsService: DiagnosticsService) {}

  @Get(':id/diagnostics')
  async getDiagnostics(@Param('id') siteId: string) {
    const data = await this.diagnosticsService.getDiagnostics(siteId);
    return data;
  }

  @Post(':id/diagnostics/refresh')
  async refreshDiagnostics(@Param('id') siteId: string) {
    const data = await this.diagnosticsService.refreshDiagnostics(siteId);
    return { success: true, data };
  }

  @Get(':id/diagnostics/php-logs')
  async getPhpLogs(@Param('id') siteId: string, @Query() query: GetLogsQueryDto) {
    const data = await this.diagnosticsService.fetchLogsFromAgent(siteId, query.lines || 100);
    return data;
  }
}
