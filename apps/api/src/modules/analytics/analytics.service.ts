import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AnalyticsSource } from '@wpcc/database';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const aggregates = await this.prisma.analyticsDaily.aggregate({
      where: {
        metricDate: { gte: thirtyDaysAgo },
        source: AnalyticsSource.GA4,
      },
      _sum: {
        sessions: true,
        users: true,
        pageviews: true,
      },
    });

    return {
      sessions: aggregates._sum.sessions || 0,
      users: aggregates._sum.users || 0,
      pageviews: aggregates._sum.pageviews || 0,
    };
  }

  async getSiteAnalytics(siteId: string, rangeDays = 30) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw new NotFoundException(`Site with ID ${siteId} not found`);
    }

    const startDate = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    const dailyMetrics = await this.prisma.analyticsDaily.findMany({
      where: {
        siteId,
        metricDate: { gte: startDate },
      },
      orderBy: { metricDate: 'asc' },
    });

    const ga4Data = dailyMetrics.filter((m) => m.source === AnalyticsSource.GA4);
    const gscData = dailyMetrics.filter((m) => m.source === AnalyticsSource.GSC);

    // Fetch top pages (aggregate over the period)
    const rawTopPages = await this.prisma.topPageDaily.findMany({
      where: {
        siteId,
        metricDate: { gte: startDate },
      },
      orderBy: { pageviews: 'desc' },
      take: 20,
    });

    // Consolidate pages (since we can have daily records for same page)
    const pageMap = new Map<string, { pagePath: string; pageTitle: string | null; pageviews: number; sessions: number; clicks: number; impressions: number }>();
    
    for (const page of rawTopPages) {
      const existing = pageMap.get(page.pagePath);
      if (existing) {
        existing.pageviews += page.pageviews || 0;
        existing.sessions += page.sessions || 0;
        existing.clicks += page.clicks || 0;
        existing.impressions += page.impressions || 0;
      } else {
        pageMap.set(page.pagePath, {
          pagePath: page.pagePath,
          pageTitle: page.pageTitle,
          pageviews: page.pageviews || 0,
          sessions: page.sessions || 0,
          clicks: page.clicks || 0,
          impressions: page.impressions || 0,
        });
      }
    }

    const topPages = Array.from(pageMap.values())
      .sort((a, b) => b.pageviews - a.pageviews)
      .slice(0, 10);

    return {
      siteId,
      rangeDays,
      ga4Data,
      gscData,
      topPages,
    };
  }
}
