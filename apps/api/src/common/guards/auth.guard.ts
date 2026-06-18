import { CanActivate, ExecutionContext, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { getJwtSecret } from '../../config/env';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid token format');
    }

    let secret: string;
    try {
      secret = getJwtSecret();
    } catch (error) {
      throw new InternalServerErrorException(error instanceof Error ? error.message : 'JWT_SECRET environment variable is missing');
    }

    try {
      const decoded = jwt.verify(token, secret) as any;
      request.user = decoded;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Token is invalid or expired');
    }
  }
}
