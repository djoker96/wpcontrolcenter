import { Module, Global } from '@nestjs/common';
import { Queue } from 'bullmq';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Global()
@Module({
  controllers: [JobsController],
  providers: [
    JobsService,
    {
      provide: 'JOBS_QUEUE',
      useFactory: () => {
        const redisHost = process.env.REDIS_HOST || 'localhost';
        const redisPort = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379;
        return new Queue('jobs', {
          connection: {
            host: redisHost,
            port: redisPort,
          },
          // Default options applied to every job added to this queue.
          // Retry failed jobs with exponential backoff, and auto-clean old
          // completed/failed jobs to prevent Redis memory bloat.
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5_000,            // 5s, 10s, 20s
            },
            removeOnComplete: { count: 100 },  // keep last 100 completed
            removeOnFail: { count: 200 },      // keep last 200 failed
          },
        });
      },
    },
  ],
  exports: [JobsService, 'JOBS_QUEUE'],
})
export class JobsModule {}
