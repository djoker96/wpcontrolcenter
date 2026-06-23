import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Queue } from 'bullmq';
import { JobStatus, LogLevel, JobType } from '@wpcc/database';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('JOBS_QUEUE') private readonly jobsQueue: Queue,
  ) {}

  // Job types whose payloadJson may contain file paths (server-local paths).
  private static readonly PATH_CARRYING_JOB_TYPES: ReadonlySet<string> = new Set([
    JobType.UPLOAD_PLUGIN,
    JobType.UPLOAD_THEME,
  ]);

  /**
   * Strip sensitive server-local file paths from a job payload before exposing
   * it to API consumers. The worker still receives full paths via the BullMQ
   * job payload, which is not exposed here.
   */
  private static redactPayload(jobType: JobType, payload: Record<string, unknown>): Record<string, unknown> {
    if (!payload || !JobsService.PATH_CARRYING_JOB_TYPES.has(jobType)) {
      return payload;
    }
    const { filePath, ...safe } = payload;
    if (filePath) {
      safe.fileName = typeof filePath === 'string' ? filePath.replace(/^.*[\\/]/, '') : undefined;
    }
    return safe;
  }

  async findAll(siteId?: string, status?: JobStatus) {
    const where: { siteId?: string; status?: JobStatus } = {};
    if (siteId) where.siteId = siteId;
    if (status) where.status = status;
    const jobs = await this.prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { site: { select: { id: true, name: true, domain: true } } },
    });
    return jobs.map((job) => ({
      ...job,
      payloadJson: JobsService.redactPayload(job.jobType as JobType, (job.payloadJson ?? {}) as Record<string, unknown>),
    }));
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { site: true, logs: { orderBy: { createdAt: 'asc' } } },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return {
      ...job,
      payloadJson: JobsService.redactPayload(job.jobType as JobType, (job.payloadJson ?? {}) as Record<string, unknown>),
    };
  }

  async retry(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== JobStatus.FAILED) {
      throw new BadRequestException('Only failed jobs can be retried');
    }

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.QUEUED,
        retryCount: { increment: 1 },
        startedAt: null,
        endedAt: null,
        errorMessage: null,
        resultJson: null,
      },
      include: { site: true },
    });

    await this.jobsQueue.add(
      'remote-action',
      { jobId: updatedJob.id },
      { jobId: `${updatedJob.id}:retry:${updatedJob.retryCount}` },
    );

    await this.prisma.jobLog.create({
      data: {
        jobId: updatedJob.id,
        level: LogLevel.INFO,
        message: `Job retried manually. Attempt #${updatedJob.retryCount}`,
      },
    });

    return updatedJob;
  }

  async cancel(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== JobStatus.QUEUED && job.status !== JobStatus.RUNNING) {
      throw new BadRequestException('Only active or queued jobs can be canceled');
    }

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.CANCELED,
        endedAt: new Date(),
      },
      include: { site: true },
    });

    const removeAttempts = [updatedJob.id, `${updatedJob.id}:retry:${updatedJob.retryCount}`];
    for (const id of removeAttempts) {
      try {
        const bullJob = await this.jobsQueue.getJob(id);
        if (bullJob) {
          await bullJob.remove();
        }
      } catch (error) {
        // Ignore removal errors best-effort
      }
    }

    await this.prisma.jobLog.create({
      data: {
        jobId: updatedJob.id,
        level: LogLevel.WARN,
        message: 'Job canceled manually by administrator',
      },
    });

    return updatedJob;
  }
}
