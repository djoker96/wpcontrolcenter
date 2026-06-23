import { PrismaClient, JobStatus, LogLevel } from '@wpcc/database';
import { decrypt, assertPublicUrl } from '@wpcc/shared';
import { createHmac } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

function getEncryptionKey(): string {
  const key = process.env.AGENT_ENCRYPTION_KEY;
  if (!key) throw new Error('AGENT_ENCRYPTION_KEY environment variable is missing');
  return key;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 60_000,
): Promise<Response> {
  await assertPublicUrl(url); // SSRF guard on all outbound requests

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const externalSignal = init.signal;
  if (externalSignal) {
    if (typeof externalSignal.addEventListener === 'function') {
      externalSignal.addEventListener('abort', () => controller.abort());
    } else if ((externalSignal as AbortSignal).aborted) {
      controller.abort();
    }
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function logToJob(prisma: PrismaClient, jobId: string, level: LogLevel, message: string, context?: any) {
  try {
    await prisma.jobLog.create({
      data: { jobId, level, message, contextJson: context || {} },
    });
  } catch (err: any) {
    console.error(`Failed to write job log: ${err.message}`);
  }
}

/**
 * Handle UPLOAD_PLUGIN and UPLOAD_THEME jobs.
 * Reads the uploaded zip file from disk, sends it to the WordPress agent,
 * cleans up the file, and triggers an inventory resync.
 */
export async function handleUploadJob(prisma: PrismaClient, jobId: string) {
  const dbJob = await prisma.job.findUnique({
    where: { id: jobId },
    include: { site: { include: { credential: true } } },
  });

  if (!dbJob || !dbJob.site || !dbJob.site.credential) {
    throw new Error(`Job or site credentials not found for ID ${jobId}`);
  }

  const site = dbJob.site;
  const credential = site.credential!; // guaranteed non-null by the check above
  const filePath = (dbJob.payloadJson as any)?.filePath as string | undefined;

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Upload file not found at ${filePath}`);
  }

  // Move to RUNNING
  await prisma.job.update({
    where: { id: jobId },
    data: { status: JobStatus.RUNNING, startedAt: new Date() },
  });

  await logToJob(prisma, jobId, LogLevel.INFO, `Started processing upload job: ${dbJob.jobType}`);

  const secretKey = decrypt(credential.secretKeyEncrypted, getEncryptionKey());
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Map job type to agent action endpoint
  const agentAction = dbJob.jobType === 'UPLOAD_PLUGIN'
    ? '/wpcc/v1/execute/install-plugin-upload'
    : '/wpcc/v1/execute/install-theme-upload';

  try {
    const fileData = fs.readFileSync(filePath);

    // HMAC signature over raw binary (same pattern as backup upload)
    const messageBytes = Buffer.concat([
      Buffer.from(`POST|${agentAction}|${timestamp}|`),
      fileData,
    ]);
    const signature = createHmac('sha256', secretKey).update(messageBytes).digest('hex');

    const targetUrl = `${site.siteUrl.replace(/\/$/, '')}/wp-json${agentAction}`;

    await logToJob(prisma, jobId, LogLevel.INFO, `Uploading ${dbJob.targetSlug || 'theme'} to agent at ${site.siteUrl}`);

    const response = await fetchWithTimeout(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-wpcc-signature': signature,
        'x-wpcc-timestamp': timestamp,
      },
      body: fileData,
    }, 120_000); // 2 min for upload

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Agent returned HTTP ${response.status}: ${errText}`);
    }

    const json = await response.json() as any;
    if (!json.success) {
      throw new Error(json.message || 'Agent failed to install update');
    }

    // Clean up the uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error(`Failed to clean up ${filePath}: ${err.message}`);
    });

    // Clean up parent directory if empty
    const parentDir = path.dirname(filePath);
    fs.rmdir(parentDir, (err) => {
      if (err && err.code !== 'ENOTEMPTY' && err.code !== 'ENOENT') {
        console.error(`Failed to clean up ${parentDir}: ${err.message}`);
      }
    });

    await logToJob(prisma, jobId, LogLevel.INFO, `Upload successful: ${json.message}`);

    // Mark job as SUCCESS
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.SUCCESS,
        resultJson: json,
        endedAt: new Date(),
      },
    });

    console.log(`[worker] Upload job ${jobId} completed successfully`);
  } catch (err: any) {
    // Mark job as FAILED
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        errorMessage: err.message,
        endedAt: new Date(),
      },
    });

    await logToJob(prisma, jobId, LogLevel.ERROR, `Upload failed: ${err.message}`);

    console.error(`[worker] Upload job ${jobId} failed: ${err.message}`);
    throw err;
  }
}
