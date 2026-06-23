import { CanActivate, ExecutionContext, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../modules/database/prisma.service';
import { getJwtSecret } from '../../config/env';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  /** Extract the wpcc_token value from a raw Cookie header, if present. */
  private readTokenCookie(cookieHeader?: string): string | undefined {
    if (!cookieHeader) return undefined;
    for (const part of cookieHeader.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === 'wpcc_token') {
        const raw = rest.join('=');
        try {
          return decodeURIComponent(raw);
        } catch {
          // Malformed percent-encoding → treat as no cookie (→ 401, not 500).
          return raw || undefined;
        }
      }
    }
    return undefined;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Prefer the httpOnly cookie; fall back to Bearer header (non-browser clients).
    let token: string | undefined = this.readTokenCookie(request.headers.cookie);
    if (!token) {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        throw new UnauthorizedException('Authentication required');
      }
      const [type, headerToken] = authHeader.split(' ');
      if (type !== 'Bearer' || !headerToken) {
        throw new UnauthorizedException('Invalid token format');
      }
      token = headerToken;
    }

    let secret: string;
    try {
      secret = getJwtSecret();
    } catch (error) {
      throw new InternalServerErrorException(error instanceof Error ? error.message : 'JWT_SECRET environment variable is missing');
    }

    let decoded: { id: string; email: string; role: string; tokenVersion: number };
    try {
      // Pin the algorithm to HS256 to prevent algorithm-confusion / alg=none forgery.
      decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as any;
    } catch (error) {
      throw new UnauthorizedException('Token is invalid or expired');
    }

    // Look up the user from the database to verify the account is still active
    // and the token version hasn't been bumped (password reset / deactivation).
    const user = await this.prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, isActive: true, tokenVersion: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is inactive or deleted');
    }

    if (user.tokenVersion !== decoded.tokenVersion) {
      throw new UnauthorizedException('Token has been revoked; please log in again');
    }

    request.user = decoded;
    return true;
  }
}
