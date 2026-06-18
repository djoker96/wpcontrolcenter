import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobsService } from '../src/modules/jobs/jobs.service';
import { JobStatus, LogLevel } from '@wpcc/database';

test('retry resets a failed job and enqueues a new BullMQ attempt', async () => {
  const job = {
    id: 'job_1',
    status: JobStatus.FAILED,
    retryCount: 1,
    queuedAt: new Date('2026-06-18T00:00:00.000Z'),
    startedAt: new Date('2026-06-18T00:01:00.000Z'),
    endedAt: new Date('2026-06-18T00:02:00.000Z'),
    errorMessage: 'Agent failed',
    resultJson: { failed: true },
  };
  const queueAdds: any[] = [];
  const logs: any[] = [];
  const prisma = {
    job: {
      findUnique: async ({ where }: any) => (where.id === job.id ? job : null),
      update: async ({ where, data, include }: any) => {
        assert.equal(where.id, job.id);
        Object.assign(job, {
          ...data,
          retryCount: typeof data.retryCount?.increment === 'number'
            ? job.retryCount + data.retryCount.increment
            : data.retryCount ?? job.retryCount,
        });
        return include?.site ? { ...job, site: { id: 'site_1', name: 'Demo', domain: 'demo.example.com' }, logs: [] } : job;
      },
    },
    jobLog: {
      create: async ({ data }: any) => {
        logs.push(data);
        return data;
      },
    },
  };
  const queue = {
    add: async (...args: any[]) => {
      queueAdds.push(args);
      return { id: args[2]?.jobId };
    },
  };

  const service = new JobsService(prisma as any, queue as any);
  const result = await service.retry(job.id);

  assert.equal(result.status, JobStatus.QUEUED);
  assert.equal(result.retryCount, 2);
  assert.equal(result.startedAt, null);
  assert.equal(result.endedAt, null);
  assert.equal(result.errorMessage, null);
  assert.deepEqual(queueAdds[0], [
    'remote-action',
    { jobId: job.id },
    { jobId: 'job_1:retry:2' },
  ]);
  assert.equal(logs[0].level, LogLevel.INFO);
});

test('cancel marks an active job canceled and removes queued BullMQ attempts best-effort', async () => {
  const job = {
    id: 'job_2',
    status: JobStatus.QUEUED,
    retryCount: 0,
    endedAt: null,
  };
  const removedJobIds: string[] = [];
  const logs: any[] = [];
  const prisma = {
    job: {
      findUnique: async ({ where }: any) => (where.id === job.id ? job : null),
      update: async ({ where, data, include }: any) => {
        assert.equal(where.id, job.id);
        Object.assign(job, data);
        return include?.site ? { ...job, site: { id: 'site_1', name: 'Demo', domain: 'demo.example.com' }, logs: [] } : job;
      },
    },
    jobLog: {
      create: async ({ data }: any) => {
        logs.push(data);
        return data;
      },
    },
  };
  const queue = {
    getJob: async (id: string) => ({
      remove: async () => {
        removedJobIds.push(id);
      },
    }),
  };

  const service = new JobsService(prisma as any, queue as any);
  const result = await service.cancel(job.id);

  assert.equal(result.status, JobStatus.CANCELED);
  assert.equal(result.endedAt instanceof Date, true);
  assert.deepEqual(removedJobIds, ['job_2', 'job_2:retry:0']);
  assert.equal(logs[0].level, LogLevel.WARN);
});
