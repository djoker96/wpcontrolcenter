import { Injectable, Logger, Inject } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { Queue } from 'bullmq';
import { JobType, JobTargetType } from '@wpcc/database';

const UPLOAD_DIR = path.resolve(process.cwd(), '../../storage/uploads');

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private prisma: PrismaService,
    @Inject('JOBS_QUEUE') private readonly jobsQueue: Queue,
  ) {}

  async handleUpload(
    siteId: string,
    file: Express.Multer.File,
    slug: string | undefined,
    jobType: JobType,
    targetType: JobTargetType,
    userId: string,
  ) {
    const jobId = randomUUID();
    const destDir = path.join(UPLOAD_DIR, siteId, jobId);
    fs.mkdirSync(destDir, { recursive: true });

    const filename = `${jobId}.zip`;
    const filepath = path.join(destDir, filename);
    fs.writeFileSync(filepath, file.buffer);

    const job = await this.prisma.job.create({
      data: {
        siteId,
        jobType,
        targetType,
        targetSlug: slug || null,
        payloadJson: {
          filePath: filepath,
          originalName: file.originalname,
          fileSize: file.size,
        },
        status: 'QUEUED',
        initiatedByUserId: userId,
        queuedAt: new Date(),
      },
    });

    await this.jobsQueue.add('remote-action', { jobId: job.id }, { jobId: job.id });

    return { success: true, jobId: job.id, status: 'QUEUED' };
  }

  async handleBulkUpload(
    siteIds: string[],
    file: Express.Multer.File,
    slug: string | undefined,
    jobType: JobType,
    targetType: JobTargetType,
    userId: string,
  ) {
    const results = [];
    for (const siteId of siteIds) {
      const result = await this.handleUpload(siteId, file, slug, jobType, targetType, userId);
      results.push({ siteId, ...result });
    }
    return { success: true, jobs: results };
  }
}
