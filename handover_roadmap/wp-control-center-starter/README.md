# WP Control Center Starter

This starter now includes:
- Prisma schema + initial migration + seed
- Fuller OpenAPI spec
- NestJS API skeleton aligned to the contract
- Worker skeleton for recurring jobs
- WordPress agent plugin skeleton

## Suggested next commands

```bash
pnpm install
pnpm prisma generate
pnpm prisma migrate deploy
pnpm tsx packages/database/prisma/seed.ts
```

## Notes
- The NestJS and plugin code are scaffolds, not production-complete.
- Remote actions, auth, queue processing, and Google integrations still need full implementation.
