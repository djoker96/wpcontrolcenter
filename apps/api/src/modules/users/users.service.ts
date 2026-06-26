import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { hashPassword } from '../../common/utils/crypto.utils';
import { UserRole } from '@wpcc/database';

const ROLE_WEIGHT: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 4,
  [UserRole.ADMIN]: 3,
  [UserRole.OPERATOR]: 2,
  [UserRole.VIEWER]: 1,
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Prevent vertical privilege escalation: an actor may only assign a role at
   *  or below their own level. */
  private assertCanAssignRole(actorRole: UserRole, targetRole?: UserRole) {
    if (!targetRole) return;
    if ((ROLE_WEIGHT[actorRole] ?? 0) < ROLE_WEIGHT[targetRole]) {
      throw new ForbiddenException('Cannot assign a role higher than your own');
    }
  }

  async create(createUserDto: CreateUserDto, actorRole: UserRole) {
    this.assertCanAssignRole(actorRole, createUserDto.role);
    const passwordHash = hashPassword(createUserDto.password);
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        passwordHash,
        fullName: createUserDto.fullName,
        role: createUserDto.role,
      },
    });

    const { passwordHash: _, ...result } = user;
    return result;
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users.map(({ passwordHash, ...user }) => user);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    const { passwordHash, ...result } = user;
    return result;
  }

  async update(id: string, updateUserDto: UpdateUserDto, actorRole: UserRole, actorId: string) {
    // Block escalating the target above the actor's level.
    this.assertCanAssignRole(actorRole, updateUserDto.role);
    // Block actors from elevating an existing user that already outranks them,
    // and from changing their own role (anti self-escalation/lockout).
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException(`User with ID ${id} not found`);
    if ((ROLE_WEIGHT[actorRole] ?? 0) < ROLE_WEIGHT[target.role]) {
      throw new ForbiddenException('Cannot modify a user with a higher role');
    }
    if (id === actorId && updateUserDto.role && updateUserDto.role !== target.role) {
      throw new ForbiddenException('Cannot change your own role');
    }

    const data: any = {
      email: updateUserDto.email,
      fullName: updateUserDto.fullName,
      role: updateUserDto.role,
      isActive: updateUserDto.isActive,
    };

    if (updateUserDto.password) {
      data.passwordHash = hashPassword(updateUserDto.password);
    }

    Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

    const user = await this.prisma.user.update({
      where: { id },
      data,
    });

    const { passwordHash: _, ...result } = user;
    return result;
  }

  async remove(id: string) {
    await this.findOne(id);
    const user = await this.prisma.user.delete({
      where: { id },
    });
    const { passwordHash: _, ...result } = user;
    return result;
  }
}
