import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { decrypt } from '../../common/utils/crypto.utils';
import { createHmac } from 'node:crypto';

@Injectable()
export class DiagnosticsService {
  constructor(private readonly prisma: PrismaService) {}

  private getEncryptionKey(): string {
    const key = process.env.AGENT_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('AGENT_ENCRYPTION_KEY environment variable is missing');
    }
    return key;
  }

  async getDiagnostics(siteId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw new NotFoundException(`Site with ID ${siteId} not found`);
    }

    const diagnostics = await this.prisma.siteDiagnostics.findUnique({
      where: { siteId },
    });

    return {
      siteId,
      siteName: site.name,
      domain: site.domain,
      diagnostics: diagnostics || null,
    };
  }

  async fetchLogsFromAgent(siteId: string, lines: number) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      include: { credential: true },
    });

    if (!site || !site.credential) {
      throw new NotFoundException(`Site or credentials not found for ID ${siteId}`);
    }

    if (site.connectionStatus !== 'CONNECTED') {
      throw new BadRequestException('Cannot fetch logs from a disconnected site');
    }

    const secretKey = decrypt(site.credential.secretKeyEncrypted, this.getEncryptionKey());
    const method = 'POST';
    const path = '/wpcc/v1/execute/php-logs';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyObj = { lines };
    const bodyStr = JSON.stringify(bodyObj);

    const message = `${method}|${path}|${timestamp}|${bodyStr}`;
    const signature = createHmac('sha256', secretKey).update(message).digest('hex');

    const targetUrl = `${site.siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/php-logs`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(targetUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-wpcc-signature': signature,
          'x-wpcc-timestamp': timestamp,
        },
        body: bodyStr,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Agent returned status ${response.status}`);
      }

      const json = await response.json() as Record<string, unknown>;
      if (!json.success) {
        throw new Error((json.message as string) || 'Failed to fetch logs from Agent');
      }

      return {
        success: true,
        logFile: (json.log_file as string) || 'error.log',
        content: (json.content as string) || '',
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      throw new BadRequestException(`Failed to connect to WordPress Agent: ${errMsg}`);
    }
  }

  async refreshDiagnostics(siteId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      include: { credential: true },
    });

    if (!site || !site.credential) {
      throw new NotFoundException(`Site or credentials not found for ID ${siteId}`);
    }

    if (site.connectionStatus !== 'CONNECTED') {
      throw new BadRequestException('Cannot refresh diagnostics for a disconnected site');
    }

    const secretKey = decrypt(site.credential.secretKeyEncrypted, this.getEncryptionKey());
    const method = 'POST';
    const path = '/wpcc/v1/execute/diagnostics';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyObj = {};
    const bodyStr = JSON.stringify(bodyObj);

    const message = `${method}|${path}|${timestamp}|${bodyStr}`;
    const signature = createHmac('sha256', secretKey).update(message).digest('hex');

    const targetUrl = `${site.siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/diagnostics`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(targetUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-wpcc-signature': signature,
          'x-wpcc-timestamp': timestamp,
        },
        body: bodyStr,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Agent returned status ${response.status}`);
      }

      const json = await response.json() as Record<string, any>;
      if (!json.success || !json.data) {
        throw new Error(json.message || 'Failed to get diagnostics from Agent');
      }

      const { disk, cron } = json.data;

      const result = await this.prisma.siteDiagnostics.upsert({
        where: { siteId },
        update: {
          diskTotalBytes: disk.total,
          diskUsedBytes: disk.used,
          cronHealthStatus: cron.health,
          cronDetailsJson: cron.late_jobs,
          lastDiagnosticsAt: new Date(),
        },
        create: {
          siteId,
          diskTotalBytes: disk.total,
          diskUsedBytes: disk.used,
          cronHealthStatus: cron.health,
          cronDetailsJson: cron.late_jobs,
          lastDiagnosticsAt: new Date(),
        },
      });

      return result;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      throw new BadRequestException(`Failed to refresh diagnostics: ${errMsg}`);
    }
  }
}
