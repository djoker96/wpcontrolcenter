import { Controller, Get, Post, Delete, Param, Body, UseGuards, Res, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { BackupsService } from './backups.service';
import { CreateBackupDto } from './dto/create-backup.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@wpcc/database';

type HeaderReply = {
  header(name: string, value: string): unknown;
};

@Controller('sites/:siteId/backups')
@UseGuards(AuthGuard, RolesGuard)
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  async getBackups(@Param('siteId') siteId: string) {
    return this.backupsService.getBackups(siteId);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  async createBackup(
    @Param('siteId') siteId: string,
    @Body() body: CreateBackupDto,
    @CurrentUser() user: any,
  ) {
    return this.backupsService.createBackupJob(siteId, body.backupType, user.id);
  }

  @Post(':id/restore')
  @Roles(UserRole.ADMIN)
  async restoreBackup(
    @Param('siteId') siteId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.backupsService.restoreBackupJob(siteId, id, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async deleteBackup(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.backupsService.deleteBackup(siteId, id);
  }

  @Get(':id/download')
  @Roles(UserRole.ADMIN)
  async downloadBackup(
    @Param('siteId') siteId: string,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: HeaderReply,
  ): Promise<StreamableFile> {
    const { filePath, filename } = await this.backupsService.getBackupFilePath(siteId, id);
    res.header('Content-Disposition', `attachment; filename="${sanitizeHeaderFilename(filename)}"`);
    res.header('Content-Type', 'application/octet-stream');
    return new StreamableFile(createReadStream(filePath));
  }
}

function sanitizeHeaderFilename(filename: string): string {
  return filename.replace(/[\r\n"]/g, '_');
}
