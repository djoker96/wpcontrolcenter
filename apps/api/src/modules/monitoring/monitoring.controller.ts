import { Controller, Get } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('overview')
  overview() { return this.monitoringService.overview(); }

  @Get('incidents')
  incidents() { return { data: [] }; }

  @Get('uptime-checks')
  uptimeChecks() { return { data: [] }; }
}
