import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuditService {
  constructor(public readonly prisma: PrismaService) {}

  /**
   * List audit log entries with optional filters.
   * When siteId is provided, restricts to that site; otherwise returns entries
   * across all sites (and site-agnostic entries like auth/user actions).
   */
  findAll(opts: { siteId?: string; action?: string; take?: number } = {}) {
    const where: { siteId?: string; action?: string } = {};
    if (opts.siteId) where.siteId = opts.siteId;
    if (opts.action) where.action = opts.action;
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(opts.take ?? 50, 200),
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        site: { select: { id: true, name: true, domain: true } },
      },
    });
  }
}
