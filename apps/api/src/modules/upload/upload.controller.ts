import {
  Controller,
  Post,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, JobType, JobTargetType } from '@wpcc/database';
import { UploadService } from './upload.service';

@Controller('sites/:id/actions')
@UseGuards(AuthGuard, RolesGuard)
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post('upload-plugin')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadPlugin(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('slug') slug: string,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('File is required');
    if (!slug) throw new BadRequestException('Plugin slug is required');
    return this.uploadService.handleUpload(
      id, file, slug, JobType.UPLOAD_PLUGIN, JobTargetType.UPLOAD_PLUGIN, req.user?.id,
    );
  }

  @Post('upload-theme')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadTheme(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('slug') slug: string,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.uploadService.handleUpload(
      id, file, slug || null, JobType.UPLOAD_THEME, JobTargetType.UPLOAD_THEME, req.user?.id,
    );
  }
}

@Controller('uploads/bulk')
@UseGuards(AuthGuard, RolesGuard)
export class BulkUploadController {
  constructor(private uploadService: UploadService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async bulkUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body('siteIds') siteIds: string,
    @Body('slug') slug: string,
    @Body('type') type: 'plugin' | 'theme',
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('File is required');

    let parsedSiteIds: string[];
    try {
      parsedSiteIds = JSON.parse(siteIds);
    } catch {
      throw new BadRequestException('siteIds must be a JSON array string');
    }

    if (!Array.isArray(parsedSiteIds) || parsedSiteIds.length === 0) {
      throw new BadRequestException('At least one site ID is required');
    }

    const jobType = type === 'plugin' ? JobType.UPLOAD_PLUGIN : JobType.UPLOAD_THEME;
    const targetType = type === 'plugin' ? JobTargetType.UPLOAD_PLUGIN : JobTargetType.UPLOAD_THEME;

    return this.uploadService.handleBulkUpload(
      parsedSiteIds, file, slug || null, jobType, targetType, req.user?.id,
    );
  }
}
