export interface UpdatePluginPayload {
  slug: string;
  version?: string;
}

export interface UpdateThemePayload {
  slug: string;
  version?: string;
}

export interface HeartbeatResponse {
  status: 'ok' | 'error';
  pendingJobsCount: number;
  timestamp: string;
}

export { decrypt, encrypt } from './crypto';
