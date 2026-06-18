import { Injectable } from '@nestjs/common';

@Injectable()
export class SitesService {
  findAll() { return [{ id: 'site_stub', domain: 'demo.example.com', status: 'ACTIVE', connectionStatus: 'CONNECTED' }]; }

  findOne(id: string) { return { id, domain: 'demo.example.com' }; }
}
