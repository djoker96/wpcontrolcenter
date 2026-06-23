import { CanActivate, ExecutionContext, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config/env';

@Injectable()
export class AuthGuard implements CanActivate {
  /** Extract the wpcc_token value from a raw Cookie header, if present. */
  private readTokenCookie(cookieHeader?: string): string | undefined {
    if (!cookieHeader) return undefined;
    for (const part of cookieHeader.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === 'wpcc_token') {
        return decodeURIComponent(rest.join('='));
      }
    }
    return undefined;
  }

  canActivate(context: ExecutionContext): boolean {
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

    try {
      // Pin the algorithm to HS256 to prevent algorithm-confusion / alg=none forgery.
      const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as any;
      request.user = decoded;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Token is invalid or expired');
    }
  }
}
