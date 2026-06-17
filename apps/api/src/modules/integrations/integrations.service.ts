import { Injectable } from '@nestjs/common';

@Injectable()
export class IntegrationsService {
  findAll() { return [{ id: 'integration_stub', provider: 'GOOGLE', status: 'ACTIVE' }]; }
}
