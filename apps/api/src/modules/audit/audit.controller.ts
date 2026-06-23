import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@wpcc/database';

@Controller('audit-logs')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(
    @Query('siteId') siteId?: string,
    @Query('action') action?: string,
    @Query('take') take?: string,
  ) {
    const data = await this.auditService.findAll({
      siteId,
      action,
      take: take ? Number(take) : undefined,
    });
    return { data };
  }
}
