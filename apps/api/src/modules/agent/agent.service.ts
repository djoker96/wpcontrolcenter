import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { decrypt } from '../../common/utils/crypto.utils';
import { ConnectionStatus } from '@wpcc/database';

@Injectable()
export class AgentService {
  constructor(private readonly prisma: PrismaService) {}

  private getEncryptionKey(): string {
    return process.env.AGENT_ENCRYPTION_KEY || '6a66632c253d82a17cb0b51de38e8cb554c8651a24d852a35368a5436d4f9bf3';
  }

  async register(connectionToken: string, siteUrl: string, domain: string) {
    if (!connectionToken) {
      throw new BadRequestException('Connection token is required');
    }

    const encKey = this.getEncryptionKey();

    // Fetch credentials that are active (have connection token)
    const credentialsList = await this.prisma.siteCredential.findMany({
      where: {
        connectionTokenEncrypted: {
          not: null,
        },
      },
    });

    let matchedCredential = null;

    for (const cred of credentialsList) {
      if (!cred.connectionTokenEncrypted) continue;
      try {
        const decryptedToken = decrypt(cred.connectionTokenEncrypted, encKey);
        if (decryptedToken === connectionToken) {
          matchedCredential = cred;
          break;
        }
      } catch (err) {
        // Skip decryption failures
      }
    }

    if (!matchedCredential) {
      throw new UnauthorizedException('Invalid or expired connection token');
    }

    const siteId = matchedCredential.siteId;
    const secretKey = decrypt(matchedCredential.secretKeyEncrypted, encKey);

    // Update site status
    await this.prisma.site.update({
      where: { id: siteId },
      data: {
        connectionStatus: ConnectionStatus.CONNECTED,
        siteUrl,
        domain,
        lastSeenAt: new Date(),
      },
    });

    // Clear connection token once used
    await this.prisma.siteCredential.update({
      where: { siteId },
      data: {
        connectionTokenEncrypted: null,
      },
    });

    // Log connection audit event
    await this.prisma.auditLog.create({
      data: {
        siteId,
        action: 'site.connect',
        entityType: 'site',
        entityId: siteId,
        payloadJson: { domain, siteUrl },
      },
    });

    return {
      success: true,
      siteId,
      publicKey: matchedCredential.publicKey,
      secretKey,
    };
  }

  async heartbeat(siteId: string, payload: any) {
    const data: any = {
      connectionStatus: ConnectionStatus.CONNECTED,
      lastSeenAt: new Date(),
    };

    if (payload.wpVersion) data.wpVersion = payload.wpVersion;
    if (payload.phpVersion) data.phpVersion = payload.phpVersion;
    if (payload.wpAgentVersion) data.wpAgentVersion = payload.wpAgentVersion;

    await this.prisma.site.update({
      where: { id: siteId },
      data,
    });

    return {
      success: true,
      timestamp: new Date().toISOString(),
      pendingJobsCount: 0,
    };
  }
}
