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
        });
      },
    },
  ],
  exports: [JobsService, 'JOBS_QUEUE'],
})
export class JobsModule {}
