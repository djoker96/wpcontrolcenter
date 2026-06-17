import { setInterval } from 'node:timers';

function tick(name: string): void {
  console.log(`[worker] ${name} tick at ${new Date().toISOString()}`);
}

setInterval(() => tick('uptime-check'), 5 * 60 * 1000);
setInterval(() => tick('analytics-sync'), 60 * 60 * 1000);
setInterval(() => tick('dispatch-jobs'), 15 * 1000);

console.log('Worker bootstrap started');
