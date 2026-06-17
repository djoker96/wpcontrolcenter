import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  findAll() { return [{ id: 'notification_stub', channelType: 'EMAIL', destination: 'ops@example.com' }]; }
}
