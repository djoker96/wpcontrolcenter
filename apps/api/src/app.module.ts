import { Module } from '@nestjs/common';
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

@Module({
  imports: [
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
  ],
})
export class AppModule {}
