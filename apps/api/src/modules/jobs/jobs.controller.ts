import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@wpcc/database';

@Controller('jobs')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  async findAll() {
    const data = await this.jobsService.findAll();
    return { data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    return this.jobsService.retry(id);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string) {
    return this.jobsService.cancel(id);
  }
}
