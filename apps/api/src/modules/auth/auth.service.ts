import { Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  login(payload: LoginDto) {
    return {
      accessToken: 'stub-access-token',
      user: {
        id: 'user_stub',
        email: payload.email,
        role: 'SUPER_ADMIN',
      },
    };
  }

  me() {
    return {
      id: 'user_stub',
      email: 'admin@example.com',
      role: 'SUPER_ADMIN',
    };
  }
}
