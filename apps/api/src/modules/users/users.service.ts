import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  findAll() { return [{ id: 'user_stub', email: 'admin@example.com', role: 'SUPER_ADMIN' }]; }
}
