import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() { return { data: this.usersService.findAll() }; }

  @Post()
  create(@Body() body: Record<string, unknown>) { return { id: 'user_new', ...body }; }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) { return { id, ...body }; }

  @Delete(':id')
  remove(@Param('id') id: string) { return { success: true, id }; }
}
