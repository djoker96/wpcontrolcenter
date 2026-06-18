import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BackupsService } from '../src/modules/backups/backups.service';
import { BackupType, BackupStatus, JobType, JobTargetType } from '@wpcc/database';

test('createBackupJob creates backup and job records and enqueues BullMQ job', async () => {
  const siteId = 'site_1';
  const userId = 'user_1';
  const backupType = BackupType.DATABASE;

  const createdBackups: any[] = [];
  const createdJobs: any[] = [];
  const queueAdds: any[] = [];

  const prisma = {
    site: {
      findUnique: async ({ where }: any) => (where.id === siteId ? { id: siteId } : null),
    },
    siteBackup: {
      create: async ({ data }: any) => {
        const record = { id: 'backup_1', ...data };
        createdBackups.push(record);
        return record;
      },
    },
    job: {
      create: async ({ data }: any) => {
        const record = { id: 'job_1', ...data };
        createdJobs.push(record);
        return record;
      },
    },
  };

  const queue = {
    add: async (...args: any[]) => {
      queueAdds.push(args);
      return { id: args[2]?.jobId };
    },
  };

  const service = new BackupsService(prisma as any, queue as any);
  const result = await service.createBackupJob(siteId, backupType, userId);

  assert.equal(result.backup.id, 'backup_1');
  assert.equal(result.backup.siteId, siteId);
  assert.equal(result.backup.backupType, backupType);
  assert.equal(result.backup.status, BackupStatus.PENDING);

  assert.equal(result.job.id, 'job_1');
  assert.equal(result.job.siteId, siteId);
  assert.equal(result.job.jobType, JobType.CREATE_BACKUP);
  assert.equal(result.job.targetType, JobTargetType.SITE);
  assert.equal(result.job.initiatedByUserId, userId);

  assert.equal(createdBackups.length, 1);
  assert.equal(createdJobs.length, 1);
  assert.equal(queueAdds.length, 1);
  assert.deepEqual(queueAdds[0], [
    'remote-action',
    { jobId: 'job_1' },
    { jobId: 'job_1' },
  ]);
});

test('restoreBackupJob creates job record and enqueues BullMQ job', async () => {
  const siteId = 'site_1';
  const backupId = 'backup_1';
  const userId = 'user_1';

  const createdJobs: any[] = [];
  const queueAdds: any[] = [];

  const prisma = {
    siteBackup: {
      findUnique: async ({ where }: any) => (where.id === backupId ? { id: backupId, siteId } : null),
    },
    job: {
      create: async ({ data }: any) => {
        const record = { id: 'job_2', ...data };
        createdJobs.push(record);
        return record;
      },
    },
  };

  const queue = {
    add: async (...args: any[]) => {
      queueAdds.push(args);
      return { id: args[2]?.jobId };
    },
  };

  const service = new BackupsService(prisma as any, queue as any);
  const result = await service.restoreBackupJob(siteId, backupId, userId);

  assert.equal(result.job.id, 'job_2');
  assert.equal(result.job.siteId, siteId);
  assert.equal(result.job.jobType, JobType.RESTORE_BACKUP);
  assert.equal(result.job.targetType, JobTargetType.SITE);
  assert.equal(result.job.initiatedByUserId, userId);

  assert.equal(createdJobs.length, 1);
  assert.equal(queueAdds.length, 1);
  assert.deepEqual(queueAdds[0], [
    'remote-action',
    { jobId: 'job_2' },
    { jobId: 'job_2' },
  ]);
});
