import { Body, Controller, Get, Post } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  findAll() { return { data: this.integrationsService.findAll() }; }

  @Post('google/connect')
  connectGoogle() { return { authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth' }; }

  @Post('google/callback')
  callback(@Body() body: Record<string, string>) { return { linked: true, code: body.code ?? null }; }
}
