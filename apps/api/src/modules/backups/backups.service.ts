import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { BackupType, BackupStatus, JobType, JobTargetType } from '@wpcc/database';
import { Queue } from 'bullmq';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class BackupsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('JOBS_QUEUE') private readonly jobsQueue: Queue,
  ) {}

  /** Resolve a backup file path, validating siteId/filename and asserting the
   *  result stays within the backups storage root (prevents path traversal). */
  private resolveBackupPath(siteId: string, filename: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(siteId)) {
      throw new BadRequestException('Invalid site id');
    }
    const root = path.resolve(__dirname, '../../../../storage/backups');
    const filePath = path.resolve(root, siteId, path.basename(filename));
    if (!filePath.startsWith(root + path.sep)) {
      throw new BadRequestException('Resolved backup path escapes storage root');
    }
    return filePath;
  }

  async getBackups(siteId: string) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    return this.prisma.siteBackup.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBackupJob(siteId: string, backupType: BackupType, userId: string) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');

    // Create backup record
    const filenamePlaceholder = `${backupType.toLowerCase()}-backup-pending-${Date.now()}`;
    const backup = await this.prisma.siteBackup.create({
      data: {
        siteId,
        backupType,
        filename: filenamePlaceholder,
        status: BackupStatus.PENDING,
      },
    });

    // Create BullMQ job
    const job = await this.prisma.job.create({
      data: {
        siteId,
        jobType: JobType.CREATE_BACKUP,
        targetType: JobTargetType.SITE,
        initiatedByUserId: userId,
        payloadJson: { backupId: backup.id, backupType },
      },
    });

    await this.jobsQueue.add(
      'remote-action',
      { jobId: job.id },
      { jobId: job.id },
    );

    return { backup, job };
  }

  async restoreBackupJob(siteId: string, backupId: string, userId: string) {
    // Scope to siteId so a backup cannot be restored onto a different site (IDOR).
    const backup = await this.prisma.siteBackup.findFirst({ where: { id: backupId, siteId } });
    if (!backup) throw new NotFoundException('Backup not found');

    const job = await this.prisma.job.create({
      data: {
        siteId,
        jobType: JobType.RESTORE_BACKUP,
        targetType: JobTargetType.SITE,
        initiatedByUserId: userId,
        payloadJson: { backupId: backup.id },
      },
    });

    await this.jobsQueue.add(
      'remote-action',
      { jobId: job.id },
      { jobId: job.id },
    );

    return { job };
  }

  async deleteBackup(siteId: string, backupId: string) {
    const backup = await this.prisma.siteBackup.findFirst({ where: { id: backupId, siteId } });
    if (!backup) throw new NotFoundException('Backup not found');

    // Remove from disk
    const filePath = this.resolveBackupPath(siteId, backup.filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`Failed to delete backup file: ${filePath}`, err);
      }
    }

    await this.prisma.siteBackup.delete({ where: { id: backupId } });
    return { success: true };
  }

  async getBackupFilePath(siteId: string, backupId: string) {
    const backup = await this.prisma.siteBackup.findFirst({ where: { id: backupId, siteId } });
    if (!backup) throw new NotFoundException('Backup not found');

    const filePath = this.resolveBackupPath(siteId, backup.filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Backup file not found on disk');
    }
    return { filePath, filename: backup.filename };
  }
}
