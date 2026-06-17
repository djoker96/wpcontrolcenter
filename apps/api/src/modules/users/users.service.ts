import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { hashPassword } from '../../common/utils/crypto.utils';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
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

  async update(id: string, updateUserDto: UpdateUserDto) {
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
