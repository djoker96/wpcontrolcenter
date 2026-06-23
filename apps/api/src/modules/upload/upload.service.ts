import { Injectable, Logger, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { Queue } from 'bullmq';
import { JobType, JobTargetType } from '@wpcc/database';

const UPLOAD_DIR = path.resolve(process.cwd(), '../../storage/uploads');

/** ZIP magic bytes — uploaded plugin/theme artifacts must be real archives. */
function isZipBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 4) return false;
  const sig = buf.subarray(0, 4);
  return (
    (sig[0] === 0x50 && sig[1] === 0x4b && sig[2] === 0x03 && sig[3] === 0x04) ||
    (sig[0] === 0x50 && sig[1] === 0x4b && sig[2] === 0x05 && sig[3] === 0x06)
  );
}

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
    // Validate the uploaded file is a real ZIP archive (blocks web-shell payloads).
    if (!file || !isZipBuffer(file.buffer)) {
      throw new BadRequestException('Uploaded file is not a valid ZIP archive');
    }

    // Validate siteId format and existence before using it in a filesystem path
    // (prevents path traversal via crafted siteId like "../../etc").
    if (!/^[a-zA-Z0-9_-]+$/.test(siteId)) {
      throw new BadRequestException('Invalid site id');
    }
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) {
      throw new NotFoundException(`Site with ID ${siteId} not found`);
    }

    const jobId = randomUUID();
    const destDir = path.join(UPLOAD_DIR, siteId, jobId);
    // Defense in depth: ensure the resolved path stays within UPLOAD_DIR.
    if (!path.resolve(destDir).startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
      throw new BadRequestException('Resolved upload path escapes the upload directory');
    }
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
