import { Injectable } from '@nestjs/common';

@Injectable()
export class AgentService {
  register() { return { success: true, siteId: 'site_stub' }; }

  heartbeat() { return { success: true, commandCount: 0 }; }
}
