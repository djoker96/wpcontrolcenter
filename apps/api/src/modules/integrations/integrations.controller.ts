import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@wpcc/database';

@Controller('integrations')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  findAll() { return { data: this.integrationsService.findAll() }; }

  @Post('google/connect')
  connectGoogle() { return { authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth' }; }

  @Post('google/callback')
  callback(@Body() body: Record<string, string>) { return { linked: true, code: body.code ?? null }; }
}
