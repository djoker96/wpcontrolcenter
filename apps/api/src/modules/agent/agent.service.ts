import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { decrypt, hashConnectionToken } from '../../common/utils/crypto.utils';
import { ConnectionStatus } from '@wpcc/database';
import { getAgentEncryptionKey } from '../../config/env';

@Injectable()
export class AgentService {
  constructor(private readonly prisma: PrismaService) {}

  async register(connectionToken: string, siteUrl: string, domain: string) {
    if (!connectionToken) {
      throw new BadRequestException('Connection token is required');
    }

    const encKey = getAgentEncryptionKey();

    // O(1) indexed lookup by keyed hash — no decrypt-all loop (token oracle/DoS).
    const tokenHash = hashConnectionToken(connectionToken, encKey);
    const matchedCredential = await this.prisma.siteCredential.findUnique({
      where: { connectionTokenHash: tokenHash },
    });

    if (!matchedCredential || !matchedCredential.connectionTokenEncrypted) {
      throw new UnauthorizedException('Invalid or expired connection token');
    }

    // Constant-time confirm the decrypted token matches (defense in depth).
    let decryptedToken: string;
    try {
      decryptedToken = decrypt(matchedCredential.connectionTokenEncrypted, encKey);
    } catch {
      throw new UnauthorizedException('Invalid or expired connection token');
    }
    const a = Buffer.from(decryptedToken);
    const b = Buffer.from(connectionToken);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid or expired connection token');
    }

    const siteId = matchedCredential.siteId;
    const secretKey = decrypt(matchedCredential.secretKeyEncrypted, encKey);

    // Perform all state changes atomically within a single transaction
    // to prevent race conditions (e.g. token cleared but site status not updated)
    await this.prisma.$transaction([
      this.prisma.site.update({
        where: { id: siteId },
        data: {
          connectionStatus: ConnectionStatus.CONNECTED,
          siteUrl,
          domain,
          lastSeenAt: new Date(),
        },
      }),
      this.prisma.siteCredential.update({
        where: { siteId },
        data: {
          connectionTokenEncrypted: null,
          connectionTokenHash: null,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          siteId,
          action: 'site.connect',
          entityType: 'site',
          entityId: siteId,
          payloadJson: { domain, siteUrl },
        },
      }),
    ]);

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
