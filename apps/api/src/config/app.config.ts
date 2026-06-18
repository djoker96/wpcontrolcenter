import { getJwtSecret } from './env';

export default () => ({
  port: Number(process.env.PORT ?? 3001),
  appName: process.env.APP_NAME ?? 'WP Control Center API',
  jwtSecret: getJwtSecret(),
});
