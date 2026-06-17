import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyticsService {
  overview() { return { sessions: 155, users: 110, pageviews: 398 }; }
}
