import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

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

    try {
      const secret = process.env.JWT_SECRET || 'super-secret-jwt-key-replace-in-production';
      const decoded = jwt.verify(token, secret) as any;
      request.user = decoded;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Token is invalid or expired');
    }
  }
}
