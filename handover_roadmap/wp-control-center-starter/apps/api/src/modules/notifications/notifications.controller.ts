import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('channels')
  findAll() { return { data: this.notificationsService.findAll() }; }

  @Post('channels')
  create(@Body() body: Record<string, unknown>) { return { id: 'notification_new', ...body }; }

  @Patch('channels/:id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) { return { id, ...body }; }

  @Delete('channels/:id')
  remove(@Param('id') id: string) { return { success: true, id }; }
}
