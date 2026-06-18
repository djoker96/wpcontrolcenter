"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_timers_1 = require("node:timers");
function tick(name) {
    console.log(`[worker] ${name} tick at ${new Date().toISOString()}`);
}
(0, node_timers_1.setInterval)(() => tick('uptime-check'), 5 * 60 * 1000);
(0, node_timers_1.setInterval)(() => tick('analytics-sync'), 60 * 60 * 1000);
(0, node_timers_1.setInterval)(() => tick('dispatch-jobs'), 15 * 1000);
console.log('Worker bootstrap started');
