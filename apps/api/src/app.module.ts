import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SitesModule } from './modules/sites/sites.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AgentModule } from './modules/agent/agent.module';
import { DiagnosticsModule } from './modules/diagnostics/diagnostics.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { BackupsModule } from './modules/backups/backups.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    // Global rate limiting: 100 requests / 60s per IP by default.
    // Override per-controller/route with @Throttle / @SkipThrottle.
    // In production behind nginx, X-Forwarded-For is trusted (see main.ts).
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
      // Stricter limiter for auth endpoints to slow brute-force.
      {
        name: 'auth',
        ttl: 60_000,
        limit: 10,
      },
    ]),
    DatabaseModule,
    AuthModule,
    UsersModule,
    SitesModule,
    JobsModule,
    MonitoringModule,
    AnalyticsModule,
    IntegrationsModule,
    NotificationsModule,
    AgentModule,
    DiagnosticsModule,
    PerformanceModule,
    BackupsModule,
    AuditModule,
  ],
  providers: [
    // Enable ThrottlerGuard globally so every route is rate-limited
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
