import { CanActivate, ExecutionContext, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../modules/database/prisma.service';
import { getJwtSecret } from '../../config/env';
import { AUTH_COOKIE, readCookie } from '../../modules/auth/auth-cookie.util';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Prefer the httpOnly cookie; fall back to Bearer header (non-browser clients).
    let token: string | undefined = readCookie(request.headers.cookie, AUTH_COOKIE);
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
