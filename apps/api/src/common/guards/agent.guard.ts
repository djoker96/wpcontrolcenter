import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../modules/database/prisma.service';
import { decrypt } from '../utils/crypto.utils';
import { getAgentEncryptionKey } from '../../config/env';
import * as crypto from 'crypto';

@Injectable()
export class AgentGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const siteId = request.headers['x-wpcc-site-id'] as string;
    const signature = request.headers['x-wpcc-signature'] as string;
    const timestamp = request.headers['x-wpcc-timestamp'] as string;

    if (!siteId || !signature || !timestamp) {
      throw new UnauthorizedException('Missing verification headers');
    }

    // Verify time skew to prevent replay attacks (allow 5-minute skew)
    const now = Math.floor(Date.now() / 1000);
    const requestTime = Number(timestamp);
    if (isNaN(requestTime) || Math.abs(now - requestTime) > 300) {
      throw new UnauthorizedException('Request timestamp has expired');
    }

    // Retrieve credential for the site
    const credentials = await this.prisma.siteCredential.findUnique({
      where: { siteId },
    });

    if (!credentials) {
      throw new UnauthorizedException('Invalid site credentials');
    }

    // Ensure the credential belongs to the claimed site (prevent cross-site impersonation)
    if (credentials.siteId !== siteId) {
      throw new UnauthorizedException('Credential site mismatch');
    }

    const encKey = getAgentEncryptionKey();
    let secretKey = '';
    try {
      secretKey = decrypt(credentials.secretKeyEncrypted, encKey);
    } catch (error) {
      throw new UnauthorizedException('Failed to decrypt site secret key');
    }

    // Recompute signature: Method|Path|Timestamp|Body
    const method = request.method;
    const path = request.originalUrl || request.url;
    
    // Normalize body representation
    let bodyStr = '';
    if (request.body && Object.keys(request.body).length > 0) {
      bodyStr = JSON.stringify(request.body);
    }

    const message = `${method}|${path}|${timestamp}|${bodyStr}`;
    const expectedSignature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');

    if (signature !== expectedSignature) {
      throw new UnauthorizedException('Invalid request signature');
    }

    // Attach site details to request context
    request.siteId = siteId;
    return true;
  }
}
