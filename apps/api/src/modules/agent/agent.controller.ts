import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentGuard } from '../../common/guards/agent.guard';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('register')
  async register(
    @Body() body: { connectionToken: string; siteUrl: string; domain: string },
  ) {
    return this.agentService.register(body.connectionToken, body.siteUrl, body.domain);
  }

  @Post('heartbeat')
  @UseGuards(AgentGuard)
  async heartbeat(@Req() req: any, @Body() body: any) {
    return this.agentService.heartbeat(req.siteId, body);
  }

  @Post('system-info')
  @UseGuards(AgentGuard)
  systemInfo(@Req() req: any, @Body() body: any) {
    return { success: true, siteId: req.siteId, payload: body };
  }

  @Post('sync/plugins')
  @UseGuards(AgentGuard)
  syncPlugins(@Req() req: any, @Body() body: any) {
    return { success: true, siteId: req.siteId, payload: body };
  }

  @Post('sync/themes')
  @UseGuards(AgentGuard)
  syncThemes(@Req() req: any, @Body() body: any) {
    return { success: true, siteId: req.siteId, payload: body };
  }

  @Post('sync/core')
  @UseGuards(AgentGuard)
  syncCore(@Req() req: any, @Body() body: any) {
    return { success: true, siteId: req.siteId, payload: body };
  }
}
