import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@wpcc/database';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

@Controller('notifications')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('channels')
  async findAll() {
    const data = await this.notificationsService.findAll();
    return { data };
  }

  @Post('channels')
  async create(@Body() dto: CreateChannelDto) {
    const data = await this.notificationsService.create(dto);
    return data;
  }

  @Patch('channels/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateChannelDto) {
    const data = await this.notificationsService.update(id, dto);
    return data;
  }

  @Delete('channels/:id')
  async remove(@Param('id') id: string) {
    const data = await this.notificationsService.remove(id);
    return { success: true, id: data.id };
  }

  @Get('events')
  async findEvents() {
    const data = await this.notificationsService.findEvents();
    return { data };
  }
}
