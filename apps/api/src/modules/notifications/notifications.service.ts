import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateChannelDto) {
    return this.prisma.notification.create({
      data: {
        channelType: dto.channelType,
        destination: dto.destination,
        isEnabled: dto.isEnabled !== undefined ? dto.isEnabled : true,
      },
    });
  }

  async update(id: string, dto: UpdateChannelDto) {
    const channel = await this.prisma.notification.findUnique({ where: { id } });
    if (!channel) {
      throw new NotFoundException(`Notification channel with ID ${id} not found`);
    }
    return this.prisma.notification.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const channel = await this.prisma.notification.findUnique({ where: { id } });
    if (!channel) {
      throw new NotFoundException(`Notification channel with ID ${id} not found`);
    }
    return this.prisma.notification.delete({ where: { id } });
  }

  async findEvents() {
    return this.prisma.notificationEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        site: { select: { name: true, domain: true } },
        incident: { select: { incidentType: true, severity: true, status: true } },
      },
    });
  }
}
