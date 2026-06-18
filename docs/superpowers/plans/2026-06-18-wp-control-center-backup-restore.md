# WP Control Center - Phase L: Backup & Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement database, files, and full backup/restore actions for managed WordPress sites, including background jobs processing and a Backups tab in the frontend site detail dashboard.

**Architecture:** Extend the Prisma schema with a `SiteBackup` model and `CREATE_BACKUP`/`RESTORE_BACKUP` job types. Implement recursive zip file backup and SQL schema/data exporter in the WordPress agent plugin. Connect the NestJS API and background Worker to stream and store backup files on the backend local workspace, and build the Backups tab UI in the Next.js frontend with live status updates.

**Tech Stack:** NestJS, TypeScript, Next.js, Prisma, PostgreSQL, BullMQ, PHP, WordPress REST API.

## Global Constraints

- Never use fallback hardcoded secret keys.
- Backups must be streamed securely using signature headers (`x-wpcc-signature`).
- Monorepo build `npm run build:all` must compile without errors.
- Frontend must pass linting without errors.

---

### Task 1: Update Database Schema for Backups

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Test: `npm run db:generate` and `npm run db:migrate -- --name add_site_backups`

**Interfaces:**
- Consumes: None (schema update).
- Produces: `SiteBackup` model, `BackupType` and `BackupStatus` enums, and expanded `JobType` enum in `@wpcc/database`.

- [ ] **Step 1: Modify packages/database/prisma/schema.prisma**
  Add the relation in `Site` model:
  ```prisma
  model Site {
    // ...
    performanceAudits  SitePerformanceAudit[]
    backups            SiteBackup[]

    @@index([status])
    @@index([connectionStatus])
    @@map("sites")
  }
  ```
  Add the new enums and model to the schema:
  ```prisma
  enum BackupStatus {
    PENDING
    RUNNING
    COMPLETED
    FAILED
  }

  enum BackupType {
    FULL
    DATABASE
    FILES
  }

  model SiteBackup {
    id           String       @id @default(cuid())
    siteId       String       @map("site_id")
    backupType   BackupType   @map("backup_type")
    filename     String
    sizeBytes    Float?       @map("size_bytes")
    status       BackupStatus @default(PENDING)
    errorMessage String?      @map("error_message")
    downloadUrl  String?      @map("download_url")
    createdAt    DateTime     @default(now()) @map("created_at")
    updatedAt    DateTime     @updatedAt @map("updated_at")

    site         Site         @relation(fields: [siteId], references: [id], onDelete: Cascade)

    @@index([siteId])
    @@map("site_backups")
  }
  ```
  And add the new job types in the `JobType` enum:
  ```prisma
  enum JobType {
    // ... other jobs
    UPDATE_PHP_CONFIG
    CREATE_BACKUP
    RESTORE_BACKUP
  }
  ```

- [ ] **Step 2: Generate Prisma Client**
  Run: `npm run db:generate`
  Expected: Generated client successfully.

- [ ] **Step 3: Run Migrations**
  Run:
  ```bash
  DATABASE_URL="postgresql://postgres:SecretPassword123!@localhost:5433/wp_control_center?schema=public" npm run db:migrate -- --name add_site_backups
  ```
  Expected: Database migrated successfully.

- [ ] **Step 4: Commit schema changes**
  Run:
  ```bash
  git add packages/database/prisma/schema.prisma
  git commit -m "db(schema): add SiteBackup model and backup job types"
  ```

---

### Task 2: WordPress Agent Plugin Backup Handlers

**Files:**
- Create: `wordpress-agent/plugin/includes/class-backup-manager.php`
- Modify: `wordpress-agent/plugin/includes/class-api.php`

**Interfaces:**
- Consumes: Backup type from REST parameters.
- Produces: Zip/SQL backup files, `/execute/create-backup`, `/execute/restore-backup`, `/execute/download-backup`, `/execute/upload-backup` and `/execute/delete-backup` endpoints.

- [ ] **Step 1: Create class-backup-manager.php**
  Implement SQL database dump (SHOW CREATE TABLE and query-based SELECT exporter) and recursive `ZipArchive` zip writer in [class-backup-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-backup-manager.php):
  ```php
  <?php
  if (!defined('ABSPATH')) { exit; }

  class WPCC_Agent_Backup_Manager {
      private $backup_dir;

      public function __construct() {
          $this->backup_dir = WP_CONTENT_DIR . '/wpcc-backups';
          if (!file_exists($this->backup_dir)) {
              wp_mkdir_p($this->backup_dir);
              // Write htaccess to deny public web access for safety
              file_put_contents($this->backup_dir . '/.htaccess', "Deny from all\n");
              file_put_contents($this->backup_dir . '/index.php', "<?php\n// Silence\n");
          }
      }

      public function create($type): array {
          $timestamp = time();
          $db_file = '';
          $zip_file = '';

          try {
              if ($type === 'DATABASE' || $type === 'FULL') {
                  $db_file = $this->dump_db($timestamp);
              }
              if ($type === 'FILES' || $type === 'FULL') {
                  $zip_file = $this->zip_files($timestamp, $db_file);
              }

              if ($type === 'FULL') {
                  // Merge both into full zip and remove temporary database sql
                  $full_zip = $this->backup_dir . "/full-backup-{$timestamp}.zip";
                  $zip = new ZipArchive();
                  if ($zip->open($full_zip, ZipArchive::CREATE) === true) {
                      $zip->addFile($db_file, basename($db_file));
                      $zip->addFile($zip_file, basename($zip_file));
                      $zip->close();
                  }
                  @unlink($db_file);
                  @unlink($zip_file);
                  $final_file = $full_zip;
              } elseif ($type === 'DATABASE') {
                  $final_file = $db_file;
              } else {
                  $final_file = $zip_file;
              }

              return [
                  'success' => true,
                  'filename' => basename($final_file),
                  'size' => filesize($final_file),
              ];
          } catch (Exception $e) {
              return ['success' => false, 'message' => $e->getMessage()];
          }
      }

      public function restore($filename): array {
          $filepath = $this->backup_dir . '/' . basename($filename);
          if (!file_exists($filepath)) {
              return ['success' => false, 'message' => 'Backup file not found.'];
          }

          try {
              if (strpos($filename, 'db-backup') !== false) {
                  $this->restore_db($filepath);
              } elseif (strpos($filename, 'files-backup') !== false) {
                  $this->restore_files($filepath);
              } elseif (strpos($filename, 'full-backup') !== false) {
                  // Extract full zip
                  $zip = new ZipArchive();
                  if ($zip->open($filepath) === true) {
                      $zip->extractTo($this->backup_dir);
                      $zip->close();
                      
                      // Look for extracted items
                      $pattern = $this->backup_dir . '/*';
                      foreach (glob($pattern) as $file) {
                          if (strpos($file, 'db-backup') !== false) {
                              $this->restore_db($file);
                              @unlink($file);
                          } elseif (strpos($file, 'files-backup') !== false) {
                              $this->restore_files($file);
                              @unlink($file);
                          }
                      }
                  }
              }
              return ['success' => true, 'message' => 'Restore completed successfully.'];
          } catch (Exception $e) {
              return ['success' => false, 'message' => $e->getMessage()];
          }
      }

      private function dump_db($timestamp): string {
          global $wpdb;
          $filepath = $this->backup_dir . "/db-backup-{$timestamp}.sql";
          $handle = fopen($filepath, 'w');

          $tables = $wpdb->get_col("SHOW TABLES");
          foreach ($tables as $table) {
              $create = $wpdb->get_row("SHOW CREATE TABLE `{$table}`", ARRAY_N);
              fwrite($handle, "\n\n" . $create[1] . ";\n\n");

              $rows = $wpdb->get_results("SELECT * FROM `{$table}`", ARRAY_A);
              foreach ($rows as $row) {
                  $fields = array_map(function($val) use ($wpdb) {
                      if ($val === null) return 'NULL';
                      return "'" . esc_sql($val) . "'";
                  }, $row);
                  fwrite($handle, "INSERT INTO `{$table}` VALUES (" . implode(',', $fields) . ");\n");
              }
          }
          fclose($handle);
          return $filepath;
      }

      private function restore_db($filepath) {
          global $wpdb;
          $queries = file_get_contents($filepath);
          $queries = explode(";\n", $queries);
          foreach ($queries as $query) {
              $query = trim($query);
              if (!empty($query)) {
                  $wpdb->query($query);
              }
          }
      }

      private function zip_files($timestamp, $exclude_db_file): string {
          $filepath = $this->backup_dir . "/files-backup-{$timestamp}.zip";
          $zip = new ZipArchive();
          if ($zip->open($filepath, ZipArchive::CREATE) !== true) {
              throw new Exception('Cannot create zip file');
          }

          $root_path = realpath(WP_CONTENT_DIR);
          $files = new RecursiveIteratorIterator(
              new RecursiveDirectoryIterator($root_path),
              RecursiveIteratorIterator::LEAVES_ONLY
          );

          foreach ($files as $name => $file) {
              if (!$file->isDir()) {
                  $file_real = $file->getRealPath();
                  // Exclude the backup directory itself and current db file
                  if (strpos($file_real, $this->backup_dir) !== false) {
                      continue;
                  }
                  $relative_path = substr($file_real, strlen($root_path) + 1);
                  $zip->addFile($file_real, $relative_path);
              }
          }
          $zip->close();
          return $filepath;
      }

      private function restore_files($filepath) {
          $zip = new ZipArchive();
          if ($zip->open($filepath) === true) {
              $zip->extractTo(WP_CONTENT_DIR);
              $zip->close();
          } else {
              throw new Exception('Failed to extract zip file');
          }
      }
  }
  ```

- [ ] **Step 2: Add Backup Endpoints to class-api.php**
  Update the REST routes and execution handlers in [class-api.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-api.php).
  Add routes registration around line 27:
  ```php
          register_rest_route('wpcc/v1', '/execute/download-backup', [
              'methods' => 'GET',
              'callback' => [$this, 'download_backup'],
              'permission_callback' => [$this, 'verify_request'],
          ]);

          register_rest_route('wpcc/v1', '/execute/upload-backup', [
              'methods' => 'POST',
              'callback' => [$this, 'upload_backup'],
              'permission_callback' => [$this, 'verify_request'],
          ]);
  ```
  Add handlers in the switches of `execute_action` around line 112:
  ```php
              case 'create-backup':
                  $res = (new WPCC_Agent_Backup_Manager())->create($body['type'] ?? 'FULL');
                  break;
              case 'restore-backup':
                  $res = (new WPCC_Agent_Backup_Manager())->restore($body['filename'] ?? '');
                  break;
              case 'delete-backup':
                  $backup_dir = WP_CONTENT_DIR . '/wpcc-backups';
                  $file = $backup_dir . '/' . basename($body['filename'] ?? '');
                  if (file_exists($file)) {
                      @unlink($file);
                      $res = ['success' => true, 'message' => 'Backup deleted from agent.'];
                  } else {
                      $res = ['success' => false, 'message' => 'Backup file not found on agent.'];
                  }
                  break;
  ```
  And add implementation for `download_backup` and `upload_backup` functions inside the `WPCC_Agent_API` class:
  ```php
      public function download_backup(WP_REST_Request $request) {
          $filename = basename($request->get_param('filename'));
          $filepath = WP_CONTENT_DIR . '/wpcc-backups/' . $filename;
          
          if (!file_exists($filepath)) {
              return new WP_Error('not_found', 'Backup file not found', ['status' => 404]);
          }

          header('Content-Description: File Transfer');
          header('Content-Type: application/octet-stream');
          header('Content-Disposition: attachment; filename="' . $filename . '"');
          header('Expires: 0');
          header('Cache-Control: must-revalidate');
          header('Pragma: public');
          header('Content-Length: ' . filesize($filepath));
          
          readfile($filepath);
          exit;
      }

      public function upload_backup(WP_REST_Request $request) {
          $filename = basename($request->get_param('filename'));
          $backup_dir = WP_CONTENT_DIR . '/wpcc-backups';
          if (!file_exists($backup_dir)) {
              wp_mkdir_p($backup_dir);
          }
          $filepath = $backup_dir . '/' . $filename;
          
          $body = $request->get_body();
          if (file_put_contents($filepath, $body) !== false) {
              return new WP_REST_Response(['success' => true, 'filename' => $filename], 200);
          }
          return new WP_REST_Response(['success' => false, 'message' => 'Failed to save uploaded backup file.'], 500);
      }
  ```

- [ ] **Step 3: Require backup manager in class-loader.php**
  Open [class-loader.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-loader.php) and append:
  ```php
  require_once __DIR__ . '/class-backup-manager.php';
  ```

- [ ] **Step 4: Commit Agent changes**
  Run:
  ```bash
  git add wordpress-agent/
  git commit -m "feat(agent): implement zip/sql backup and restore handlers"
  ```

---

### Task 3: Backend API for Backup Management

**Files:**
- Create: `apps/api/src/modules/backups/dto/create-backup.dto.ts`
- Create: `apps/api/src/modules/backups/backups.controller.ts`
- Create: `apps/api/src/modules/backups/backups.service.ts`
- Create: `apps/api/src/modules/backups/backups.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: Express request parameters and Body payloads.
- Produces: REST API endpoints for backups management (`POST /api/sites/:siteId/backups`, `GET /api/sites/:siteId/backups`, etc.).

- [ ] **Step 1: Create CreateBackupDto**
  Create [create-backup.dto.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/modules/backups/dto/create-backup.dto.ts):
  ```typescript
  import { IsEnum } from 'class-validator';
  import { BackupType } from '@wpcc/database';

  export class CreateBackupDto {
    @IsEnum(BackupType)
    backupType!: BackupType;
  }
  ```

- [ ] **Step 2: Create BackupsService**
  Create [backups.service.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/modules/backups/backups.service.ts):
  ```typescript
  import { Injectable, NotFoundException, Inject } from '@nestjs/common';
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
      const backup = await this.prisma.siteBackup.findUnique({ where: { id: backupId } });
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
      const backup = await this.prisma.siteBackup.findUnique({ where: { id: backupId } });
      if (!backup) throw new NotFoundException('Backup not found');

      // Remove from disk
      const storageDir = path.resolve(__dirname, '../../../../storage/backups', siteId);
      const filePath = path.join(storageDir, backup.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await this.prisma.siteBackup.delete({ where: { id: backupId } });
      return { success: true };
    }

    async getBackupFilePath(siteId: string, backupId: string) {
      const backup = await this.prisma.siteBackup.findUnique({ where: { id: backupId } });
      if (!backup) throw new NotFoundException('Backup not found');

      const storageDir = path.resolve(__dirname, '../../../../storage/backups', siteId);
      const filePath = path.join(storageDir, backup.filename);
      if (!fs.existsSync(filePath)) {
        throw new NotFoundException('Backup file not found on disk');
      }
      return { filePath, filename: backup.filename };
    }
  }
  ```

- [ ] **Step 3: Create BackupsController**
  Create [backups.controller.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/modules/backups/backups.controller.ts):
  ```typescript
  import { Controller, Get, Post, Delete, Param, Body, UseGuards, Res } from '@nestjs/common';
  import { BackupsService } from './backups.service';
  import { CreateBackupDto } from './dto/create-backup.dto';
  import { AuthGuard } from '../../common/guards/auth.guard';
  import { RolesGuard } from '../../common/guards/roles.guard';
  import { Roles } from '../../common/decorators/roles.decorator';
  import { CurrentUser } from '../../common/decorators/current-user.decorator';
  import { UserRole } from '@wpcc/database';
  import { Response } from 'express';

  @Controller('sites/:siteId/backups')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  export class BackupsController {
    constructor(private readonly backupsService: BackupsService) {}

    @Get()
    async getBackups(@Param('siteId') siteId: string) {
      return this.backupsService.getBackups(siteId);
    }

    @Post()
    async createBackup(
      @Param('siteId') siteId: string,
      @Body() body: CreateBackupDto,
      @CurrentUser() user: any,
    ) {
      return this.backupsService.createBackupJob(siteId, body.backupType, user.id);
    }

    @Post(':id/restore')
    async restoreBackup(
      @Param('siteId') siteId: string,
      @Param('id') id: string,
      @CurrentUser() user: any,
    ) {
      return this.backupsService.restoreBackupJob(siteId, id, user.id);
    }

    @Delete(':id')
    async deleteBackup(@Param('siteId') siteId: string, @Param('id') id: string) {
      return this.backupsService.deleteBackup(siteId, id);
    }

    @Get(':id/download')
    async downloadBackup(
      @Param('siteId') siteId: string,
      @Param('id') id: string,
      @Res() res: Response,
    ) {
      const { filePath, filename } = await this.backupsService.getBackupFilePath(siteId, id);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.sendFile(filePath);
    }
  }
  ```

- [ ] **Step 4: Create BackupsModule**
  Create [backups.module.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/modules/backups/backups.module.ts):
  ```typescript
  import { Module } from '@nestjs/common';
  import { BackupsController } from './backups.controller';
  import { BackupsService } from './backups.service';

  @Module({
    controllers: [BackupsController],
    providers: [BackupsService],
    exports: [BackupsService],
  })
  export class BackupsModule {}
  ```

- [ ] **Step 5: Register BackupsModule in AppModule**
  Modify [app.module.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/app.module.ts) to register the module.
  ```typescript
  import { BackupsModule } from './modules/backups/backups.module';

  @Module({
    imports: [
      // ...
      BackupsModule,
    ],
  })
  ```

- [ ] **Step 6: Commit backend changes**
  Run:
  ```bash
  git add apps/api/src/modules/backups/ apps/api/src/app.module.ts
  git commit -m "feat(api): implement backup management controllers and services"
  ```

---

### Task 4: Worker Engine for Backup and Restore Jobs

**Files:**
- Modify: `apps/worker/src/index.ts`

**Interfaces:**
- Consumes: BullMQ jobs of type `CREATE_BACKUP` and `RESTORE_BACKUP`.
- Produces: Filesystem backup writes and streaming uploads to the WordPress site.

- [ ] **Step 1: Add Job processors in worker index.ts**
  Open [index.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/worker/src/index.ts) and add imports:
  ```typescript
  import * as path from 'path';
  import * as fs from 'fs';
  ```
  Add case clauses in job dispatcher:
  ```typescript
        case 'CREATE_BACKUP':
          await handleCreateBackupJob(jobId);
          break;
        case 'RESTORE_BACKUP':
          await handleRestoreBackupJob(jobId);
          break;
  ```
  And define these two background handler functions:
  ```typescript
  async function handleCreateBackupJob(jobId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { site: { include: { credential: true } } },
    });

    if (!job || !job.site || !job.site.credential) {
      throw new Error(`Job or credentials not found for ID ${jobId}`);
    }

    const { backupId, backupType } = job.payloadJson as { backupId: string, backupType: string };

    await prisma.job.update({ where: { id: jobId }, data: { status: 'RUNNING', startedAt: new Date() } });
    await prisma.siteBackup.update({ where: { id: backupId }, data: { status: 'RUNNING' } });

    const secretKey = decrypt(job.site.credential.secretKeyEncrypted, getEncryptionKey());
    const method = 'POST';
    const pathUrl = '/wpcc/v1/execute/create-backup';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyObj = { type: backupType };
    const bodyStr = JSON.stringify(bodyObj);

    const message = `${method}|${pathUrl}|${timestamp}|${bodyStr}`;
    const signature = createHmac('sha256', secretKey).update(message).digest('hex');
    const targetUrl = `${job.site.siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/create-backup`;

    try {
      const response = await fetch(targetUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-wpcc-signature': signature,
          'x-wpcc-timestamp': timestamp,
        },
        body: bodyStr,
      });

      if (!response.ok) {
        throw new Error(`Agent backup create returned status ${response.status}`);
      }

      const json = await response.json() as any;
      if (!json.success || !json.filename) {
        throw new Error(json.message || 'Backup failed on WordPress Agent');
      }

      const filename = json.filename;

      // Now download the backup file from Agent
      const downloadPath = `/wpcc/v1/execute/download-backup`;
      const downloadQuery = `?filename=${encodeURIComponent(filename)}`;
      const downloadMsg = `GET|${downloadPath}|${timestamp}|`;
      const downloadSignature = createHmac('sha256', secretKey).update(downloadMsg).digest('hex');
      const downloadTarget = `${job.site.siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/download-backup${downloadQuery}`;

      const fileRes = await fetch(downloadTarget, {
        method: 'GET',
        headers: {
          'x-wpcc-signature': downloadSignature,
          'x-wpcc-timestamp': timestamp,
        },
      });

      if (!fileRes.ok) {
        throw new Error(`Failed to download backup: HTTP ${fileRes.status}`);
      }

      const storageDir = path.resolve(__dirname, '../../storage/backups', job.siteId);
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      
      const fileDest = path.join(storageDir, filename);
      const arrayBuffer = await fileRes.arrayBuffer();
      fs.writeFileSync(fileDest, Buffer.from(arrayBuffer));

      // Delete the backup on the agent to save space
      const deleteTarget = `${job.site.siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/delete-backup`;
      const deleteBody = JSON.stringify({ filename });
      const deleteMsg = `POST|/wpcc/v1/execute/delete-backup|${timestamp}|${deleteBody}`;
      const deleteSignature = createHmac('sha256', secretKey).update(deleteMsg).digest('hex');
      await fetch(deleteTarget, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wpcc-signature': deleteSignature,
          'x-wpcc-timestamp': timestamp,
        },
        body: deleteBody,
      });

      const downloadUrl = `/api/sites/${job.siteId}/backups/${backupId}/download`;
      await prisma.siteBackup.update({
        where: { id: backupId },
        data: {
          status: 'COMPLETED',
          filename,
          sizeBytes: json.size,
          downloadUrl,
        },
      });

      await prisma.job.update({ where: { id: jobId }, data: { status: 'SUCCESS', endedAt: new Date() } });
    } catch (err: any) {
      const errMsg = err.message || 'Unknown error';
      await prisma.siteBackup.update({ where: { id: backupId }, data: { status: 'FAILED', errorMessage: errMsg } });
      await prisma.job.update({ where: { id: jobId }, data: { status: 'FAILED', endedAt: new Date(), errorMessage: errMsg } });
    }
  }

  async handleRestoreBackupJob(jobId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { site: { include: { credential: true } } },
    });

    if (!job || !job.site || !job.site.credential) {
      throw new Error(`Job or credentials not found for ID ${jobId}`);
    }

    const { backupId } = job.payloadJson as { backupId: string };
    const backup = await prisma.siteBackup.findUnique({ where: { id: backupId } });
    if (!backup) {
      throw new Error(`Backup file record not found for ID ${backupId}`);
    }

    await prisma.job.update({ where: { id: jobId }, data: { status: 'RUNNING', startedAt: new Date() } });

    const storageDir = path.resolve(__dirname, '../../storage/backups', job.siteId);
    const filePath = path.join(storageDir, backup.filename);

    if (!fs.existsSync(filePath)) {
      throw new Error('Backup file is missing from backend storage');
    }

    const secretKey = decrypt(job.site.credential.secretKeyEncrypted, getEncryptionKey());
    const timestamp = Math.floor(Date.now() / 1000).toString();

    try {
      // 1. Upload file to agent
      const fileData = fs.readFileSync(filePath);
      const uploadPath = '/wpcc/v1/execute/upload-backup';
      const uploadQuery = `?filename=${encodeURIComponent(backup.filename)}`;
      // For binary body, hash/HMAC is calculated over raw bytes
      const messageBytes = Buffer.concat([
        Buffer.from(`POST|${uploadPath}|${timestamp}|`),
        fileData
      ]);
      const uploadSignature = createHmac('sha256', secretKey).update(messageBytes).digest('hex');
      const uploadTarget = `${job.site.siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/upload-backup${uploadQuery}`;

      const uploadRes = await fetch(uploadTarget, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-wpcc-signature': uploadSignature,
          'x-wpcc-timestamp': timestamp,
        },
        body: fileData,
      });

      if (!uploadRes.ok) {
        throw new Error(`Failed to upload backup to Agent: HTTP ${uploadRes.status}`);
      }

      // 2. Trigger restore on agent
      const restoreTarget = `${job.site.siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/restore-backup`;
      const restoreBody = JSON.stringify({ filename: backup.filename });
      const restoreMsg = `POST|/wpcc/v1/execute/restore-backup|${timestamp}|${restoreBody}`;
      const restoreSignature = createHmac('sha256', secretKey).update(restoreMsg).digest('hex');

      const restoreRes = await fetch(restoreTarget, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wpcc-signature': restoreSignature,
          'x-wpcc-timestamp': timestamp,
        },
        body: restoreBody,
      });

      if (!restoreRes.ok) {
        throw new Error(`Failed to restore backup: HTTP ${restoreRes.status}`);
      }

      const json = await restoreRes.json() as any;
      if (!json.success) {
        throw new Error(json.message || 'Agent failed to restore files/database');
      }

      await prisma.job.update({ where: { id: jobId }, data: { status: 'SUCCESS', endedAt: new Date() } });
    } catch (err: any) {
      const errMsg = err.message || 'Unknown error';
      await prisma.job.update({ where: { id: jobId }, data: { status: 'FAILED', endedAt: new Date(), errorMessage: errMsg } });
    }
  }
  ```

- [ ] **Step 2: Commit worker changes**
  Run:
  ```bash
  git add apps/worker/src/index.ts
  git commit -m "feat(worker): implement CREATE_BACKUP and RESTORE_BACKUP job handlers"
  ```

---

### Task 5: Frontend Dashboard UI for Backups

**Files:**
- Modify: `apps/web/app/sites/[id]/page.tsx`

**Interfaces:**
- Consumes: Backend backups API (`GET /api/sites/:siteId/backups`, etc.).
- Produces: Visual Backups tab, backups list, backup type selector modal, and download button.

- [ ] **Step 1: Open apps/web/app/sites/[id]/page.tsx**
  Add Backups State declarations around line 180:
  ```typescript
    const [backups, setBackups] = useState<any[]>([]);
    const [loadingBackups, setLoadingBackups] = useState(false);
    const [creatingBackup, setCreatingBackup] = useState(false);
  ```
  Add backups fetcher function around line 375:
  ```typescript
    const fetchBackups = async () => {
      setLoadingBackups(true);
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`${API_URL}/sites/${id}/backups`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        setBackups(Array.isArray(json) ? json : []);
      } catch (err) {
        console.error('Failed to load backups', err);
      } finally {
        setLoadingBackups(false);
      }
    };
  ```
  Call `fetchBackups()` in `useEffect` or tab click handler.
  Create backing functions:
  ```typescript
    const handleCreateBackup = async (type: string) => {
      setCreatingBackup(true);
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`${API_URL}/sites/${id}/backups`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ backupType: type }),
        });
        if (res.ok) {
          fetchBackups();
          fetchData(); // refresh overview jobs
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCreatingBackup(false);
      }
    };

    const handleRestoreBackup = async (backupId: string) => {
      if (!confirm('Are you sure you want to restore this backup? This will overwrite your current site data.')) return;
      try {
        const token = localStorage.getItem('accessToken');
        await fetch(`${API_URL}/sites/${id}/backups/${backupId}/restore`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchData();
      } catch (err) {
        console.error(err);
      }
    };

    const handleDeleteBackup = async (backupId: string) => {
      if (!confirm('Permanently delete this backup?')) return;
      try {
        const token = localStorage.getItem('accessToken');
        await fetch(`${API_URL}/sites/${id}/backups/${backupId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchBackups();
      } catch (err) {
        console.error(err);
      }
    };
  ```

- [ ] **Step 2: Add Backup tab trigger**
  Add the "Backups" button inside the Tab list UI:
  ```tsx
  <button onClick={() => { setActiveTab('backups'); fetchBackups(); }} className={`px-4 py-2 rounded-lg ${activeTab === 'backups' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}>Backups</button>
  ```

- [ ] **Step 3: Render Backups tab panel**
  Add the backups panel container inside the main content view:
  ```tsx
  {activeTab === 'backups' && (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-white">Site Backups</h3>
        <div className="flex gap-2">
          <button onClick={() => handleCreateBackup('DATABASE')} disabled={creatingBackup} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm">Backup Database</button>
          <button onClick={() => handleCreateBackup('FILES')} disabled={creatingBackup} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm">Backup Files</button>
          <button onClick={() => handleCreateBackup('FULL')} disabled={creatingBackup} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm">Full Backup</button>
        </div>
      </div>
      
      {loadingBackups ? (
        <div className="text-center text-zinc-500 py-10">Loading backups...</div>
      ) : backups.length === 0 ? (
        <div className="text-center text-zinc-600 py-10 italic">No backups found for this site.</div>
      ) : (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 text-sm">
              <th className="py-2">Date</th>
              <th className="py-2">Filename</th>
              <th className="py-2">Type</th>
              <th className="py-2">Size</th>
              <th className="py-2">Status</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((bk) => (
              <tr key={bk.id} className="border-b border-zinc-850 text-white text-sm">
                <td className="py-3">{new Date(bk.createdAt).toLocaleString()}</td>
                <td className="py-3 font-mono text-xs text-zinc-300">{bk.filename}</td>
                <td className="py-3"><span className="px-2 py-0.5 rounded bg-zinc-800 text-xs">{bk.backupType}</span></td>
                <td className="py-3">{bk.sizeBytes ? `${(bk.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : '—'}</td>
                <td className="py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${bk.status === 'COMPLETED' ? 'bg-green-950 text-green-400' : bk.status === 'FAILED' ? 'bg-red-950 text-red-400' : 'bg-yellow-950 text-yellow-400'}`}>
                    {bk.status}
                  </span>
                </td>
                <td className="py-3 text-right">
                  {bk.status === 'COMPLETED' && (
                    <a href={`${API_URL}/sites/${id}/backups/${bk.id}/download?token=${localStorage.getItem('accessToken')}`} className="text-blue-400 hover:underline mr-3 text-xs">Download</a>
                  )}
                  {bk.status === 'COMPLETED' && (
                    <button onClick={() => handleRestoreBackup(bk.id)} className="text-yellow-400 hover:underline mr-3 text-xs">Restore</button>
                  )}
                  <button onClick={() => handleDeleteBackup(bk.id)} className="text-red-400 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )}
  ```

- [ ] **Step 4: Verify Frontend Linting**
  Run:
  ```bash
  npm run lint -w apps/web
  ```
  Expected: Passed successfully.

- [ ] **Step 5: Commit Frontend changes**
  Run:
  ```bash
  git add apps/web/
  git commit -m "feat(web): build Backups tab UI and REST action bindings"
  ```

---

## Verification Plan

### Automated Tests
- Build all projects using `npm run build:all`.
- Verify API unit tests still pass using `npm run test -w apps/api`.

### Manual Verification
1. Add a WordPress site and connect the agent.
2. Under "Backups" tab, click "Backup Database". Verify the BullMQ job executes, logs progress, downloads the backup file to backend storage, and shows status `COMPLETED`.
3. Check the downloaded `.sql` file in backend `storage/backups/<siteId>/` to confirm database schema/inserts are correctly exported.
4. Click "Restore" on the backup and verify agent restores the database.
5. Verify download link downloads file with attachment header.
