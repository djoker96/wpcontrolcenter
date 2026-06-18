import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Queue } from 'bullmq';
import { JobStatus, LogLevel } from '@wpcc/database';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('JOBS_QUEUE') private readonly jobsQueue: Queue,
  ) {}

  async findAll() {
    return this.prisma.job.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { site: true, logs: { orderBy: { createdAt: 'asc' } } },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return job;
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
