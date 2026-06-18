import { Injectable } from '@nestjs/common';

@Injectable()
export class MonitoringService {
  overview() { return { totalSites: 1, downSites: 0, activeIncidents: 0 }; }
}
