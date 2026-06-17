import { Controller, Get, Param, Post, UseGuards, NotImplementedException } from '@nestjs/common';
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
  findAll() { return { data: this.jobsService.findAll() }; }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.jobsService.findOne(id); }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    throw new NotImplementedException('Job retry capability is not implemented yet.');
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) { return { id, status: 'CANCELED' }; }
}
