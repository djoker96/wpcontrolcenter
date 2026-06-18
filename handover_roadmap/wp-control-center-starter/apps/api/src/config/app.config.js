"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
    port: Number(process.env.PORT ?? 3001),
    appName: process.env.APP_NAME ?? 'WP Control Center API',
    jwtSecret: process.env.JWT_SECRET ?? 'change-me',
});
