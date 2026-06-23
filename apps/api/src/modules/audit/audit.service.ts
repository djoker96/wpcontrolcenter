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
    const requested = Number.isFinite(opts.take) ? (opts.take as number) : 50;
    const take = Math.min(Math.max(1, Math.floor(requested)), 200);
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        site: { select: { id: true, name: true, domain: true } },
      },
    });
  }
}
