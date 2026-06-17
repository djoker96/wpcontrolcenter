import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const totalSites = await this.prisma.site.count({ where: { status: 'ACTIVE' } });
    const activeIncidents = await this.prisma.incident.count({ where: { status: 'OPEN' } });

    // Group checks by siteId, take latest check for each site to see if it is down
    const sites = await this.prisma.site.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    let downSites = 0;
    for (const site of sites) {
      const lastCheck = await this.prisma.uptimeCheck.findFirst({
        where: { siteId: site.id },
        orderBy: { checkedAt: 'desc' },
      });
      if (lastCheck && !lastCheck.isUp) {
        downSites++;
      }
    }

    return {
      totalSites,
      downSites,
      activeIncidents,
    };
  }

  async findManyIncidents() {
    return this.prisma.incident.findMany({
      orderBy: { startedAt: 'desc' },
      include: {
        site: {
          select: {
            name: true,
            domain: true,
          },
        },
      },
      take: 50,
    });
  }

  async findManyUptimeChecks() {
    return this.prisma.uptimeCheck.findMany({
      orderBy: { checkedAt: 'desc' },
      include: {
        site: {
          select: {
            name: true,
            domain: true,
          },
        },
      },
      take: 100,
    });
  }
}
