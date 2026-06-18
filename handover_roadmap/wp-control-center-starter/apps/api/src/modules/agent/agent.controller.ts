import { Body, Controller, Post } from '@nestjs/common';
import { AgentService } from './agent.service';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('register')
  register(@Body() body: Record<string, unknown>) { return this.agentService.register(); }

  @Post('heartbeat')
  heartbeat(@Body() body: Record<string, unknown>) { return this.agentService.heartbeat(); }

  @Post('system-info')
  systemInfo(@Body() body: Record<string, unknown>) { return { success: true, payload: body }; }

  @Post('sync/plugins')
  syncPlugins(@Body() body: Record<string, unknown>) { return { success: true, payload: body }; }

  @Post('sync/themes')
  syncThemes(@Body() body: Record<string, unknown>) { return { success: true, payload: body }; }

  @Post('sync/core')
  syncCore(@Body() body: Record<string, unknown>) { return { success: true, payload: body }; }
}
