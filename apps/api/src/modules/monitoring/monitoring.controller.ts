import { Controller, Get, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@wpcc/database';

@Controller('monitoring')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('overview')
  overview() { return this.monitoringService.overview(); }

  @Get('incidents')
  incidents() { return { data: [] }; }

  @Get('uptime-checks')
  uptimeChecks() { return { data: [] }; }
}
