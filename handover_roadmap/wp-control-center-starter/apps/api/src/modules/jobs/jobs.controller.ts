import { Controller, Get, Param, Post } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  findAll() { return { data: this.jobsService.findAll() }; }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.jobsService.findOne(id); }

  @Post(':id/retry')
  retry(@Param('id') id: string) { return { id, status: 'QUEUED' }; }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) { return { id, status: 'CANCELED' }; }
}
