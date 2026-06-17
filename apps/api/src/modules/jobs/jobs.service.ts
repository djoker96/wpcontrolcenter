import { Injectable } from '@nestjs/common';

@Injectable()
export class JobsService {
  findAll() { return [{ id: 'job_stub', status: 'QUEUED', jobType: 'UPDATE_PLUGIN' }]; }

  findOne(id: string) { return { id, status: 'QUEUED' }; }
}
