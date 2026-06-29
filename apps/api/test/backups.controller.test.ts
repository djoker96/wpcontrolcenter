import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StreamableFile } from '@nestjs/common';
import { BackupsController } from '../src/modules/backups/backups.controller';

test('downloadBackup returns a StreamableFile and writes download headers without Express APIs', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wpcc-backup-test-'));
  const filePath = join(dir, 'site.sql');
  writeFileSync(filePath, 'backup');
  const headers: Record<string, string> = {};
  const reply = {
    header: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
      return reply;
    },
  };
  const backupsService = {
    getBackupFilePath: async () => ({ filePath, filename: 'site"\r\n.sql' }),
  };
  const controller = new BackupsController(backupsService as any);

  const result: any = await controller.downloadBackup('site_1', 'backup_1', reply as any);

  assert.equal(result instanceof StreamableFile, true);
  assert.equal(headers['content-type'], 'application/octet-stream');
  assert.equal(headers['content-disposition'], 'attachment; filename="site___.sql"');
});
