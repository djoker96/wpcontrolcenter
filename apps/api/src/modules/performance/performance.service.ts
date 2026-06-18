import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

interface PageSpeedApiResponse {
  lighthouseResult?: {
    categories?: {
      performance?: { score?: number };
      accessibility?: { score?: number };
      'best-practices'?: { score?: number };
      seo?: { score?: number };
    };
    audits?: {
      'largest-contentful-paint'?: { numericValue?: number };
      'interactive'?: { numericValue?: number };
      'cumulative-layout-shift'?: { numericValue?: number };
    };
  };
}

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getPerformanceHistory(siteId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw new NotFoundException(`Site with ID ${siteId} not found`);
    }

    const audits = await this.prisma.sitePerformanceAudit.findMany({
      where: { siteId },
      orderBy: { auditedAt: 'desc' },
      take: 30, // Get last 30 audits
    });

    return {
      siteId,
      siteName: site.name,
      domain: site.domain,
      audits,
    };
  }

  async triggerManualAudit(siteId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw new NotFoundException(`Site with ID ${siteId} not found`);
    }

    // Call PageSpeed API inline
    const apiKey = process.env.PAGESPEED_API_KEY || '';
    const keyParam = apiKey ? `&key=${apiKey}` : '';
    const targetUrl = `https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(site.siteUrl)}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO${keyParam}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000); // 35 seconds timeout

    try {
      const response = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`PageSpeed API returned status ${response.status}`);
      }

      const json = await response.json() as PageSpeedApiResponse;
      const categories = json.lighthouseResult?.categories;
      const audits = json.lighthouseResult?.audits;

      const getScore = (val: number | undefined) => val !== undefined ? Math.round(val * 100) : 0;

      const performanceScore = getScore(categories?.performance?.score);
      const accessibilityScore = getScore(categories?.accessibility?.score);
      const bestPracticesScore = getScore(categories?.['best-practices']?.score);
      const seoScore = getScore(categories?.seo?.score);

      const lcp = audits?.['largest-contentful-paint']?.numericValue ?? null;
      const inp = audits?.['interactive']?.numericValue ?? null;
      const cls = audits?.['cumulative-layout-shift']?.numericValue ?? null;

      const newAudit = await this.prisma.sitePerformanceAudit.create({
        data: {
          siteId,
          performanceScore,
          accessibilityScore,
          bestPracticesScore,
          seoScore,
          lcpMs: lcp,
          inpMs: inp,
          cls: cls,
        },
      });

      return newAudit;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      throw new BadRequestException(`Failed to complete PageSpeed test: ${msg}`);
    }
  }
}
