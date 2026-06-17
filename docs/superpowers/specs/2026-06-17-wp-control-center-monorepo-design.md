# Design Spec: WP Control Center Monorepo Setup

## 1. Objective
Establish a unified monorepo structure using **npm Workspaces** for the **WP Control Center** project. This setup integrates the Next.js Admin Dashboard, NestJS API, BullMQ Worker, Prisma Database connection layer, and the WordPress Agent Plugin in a structured, type-safe development environment.

## 2. Directory Structure
The workspace will be organized as follows:
```text
wp-control-center/
├── apps/
│   ├── web/                    # Next.js admin dashboard (moved from root)
│   ├── api/                    # NestJS API backend (moved from starter skeleton)
│   └── worker/                 # BullMQ worker service (moved from starter skeleton)
│
├── packages/
│   ├── database/               # Shared database package managing Prisma Client
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── package.json
│   │   └── src/index.ts
│   └── shared/                 # Shared package containing common TS types and interfaces
│       ├── package.json
│       └── src/index.ts
│
├── wordpress-agent/            # Custom WordPress management agent plugin
│   └── plugin/
│
├── docker-compose.yml          # Container configuration for Postgres & Redis
├── package.json                # Root package.json configuring workspaces
├── tsconfig.json               # Root tsconfig managing global aliases
└── README.md
```

## 3. Monorepo Configuration

### 3.1 Root package.json
```json
{
  "name": "wp-control-center-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev:web": "npm run dev -w apps/web",
    "dev:api": "npm run dev -w apps/api",
    "dev:worker": "npm run dev -w apps/worker",
    "build:all": "npm run build --workspaces --if-present",
    "db:generate": "npm run generate -w packages/database",
    "db:migrate": "npm run migrate:dev -w packages/database",
    "db:seed": "npm run seed -w packages/database"
  }
}
```

### 3.2 docker-compose.yml
Configures PostgreSQL (v16) and Redis (v7) containers.
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: wpcc-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: SecretPassword123!
      POSTGRES_DB: wp_control_center
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  redis:
    image: redis:7-alpine
    container_name: wpcc-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: always

volumes:
  postgres_data:
  redis_data:
```

### 3.3 Root .env Variables
```env
# Application Settings
NODE_ENV=development
PORT=3003

# Database Settings
DATABASE_URL="postgresql://postgres:SecretPassword123!@localhost:5432/wp_control_center?schema=public"

# Redis Queue Settings
REDIS_HOST=localhost
REDIS_PORT=6379

# Authentication Security
JWT_SECRET="super-secret-jwt-key-replace-in-production"
JWT_EXPIRES_IN="1d"

# Agent Security (32 bytes hex key for connection encryption)
AGENT_ENCRYPTION_KEY="6a66632c253d82a17cb0b51de38e8cb554c8651a24d852a35368a5436d4f9bf3"

# Uptime Monitor Interval
UPTIME_CHECK_INTERVAL_SECONDS=300
```

## 4. Shared Packages

### 4.1 `@wpcc/database`
Handles the database connection using Prisma.
*   **package.json**:
    ```json
    {
      "name": "@wpcc/database",
      "version": "1.0.0",
      "main": "dist/index.js",
      "types": "dist/index.d.ts",
      "scripts": {
        "build": "tsc",
        "generate": "prisma generate",
        "migrate:dev": "prisma migrate dev",
        "migrate:deploy": "prisma migrate deploy",
        "seed": "ts-node prisma/seed.ts"
      },
      "dependencies": {
        "@prisma/client": "^5.14.0"
      },
      "devDependencies": {
        "prisma": "^5.14.0",
        "typescript": "^5.4.5"
      }
    }
    ```
*   **src/index.ts**:
    ```typescript
    export * from '@prisma/client';
    ```

### 4.2 `@wpcc/shared`
Ensures strict type compliance between the Dashboard Web app and the API backend.
*   **package.json**:
    ```json
    {
      "name": "@wpcc/shared",
      "version": "1.0.0",
      "main": "dist/index.js",
      "types": "dist/index.d.ts",
      "scripts": {
        "build": "tsc"
      },
      "devDependencies": {
        "typescript": "^5.4.5"
      }
    }
    ```
*   **src/index.ts**:
    ```typescript
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
    ```

## 5. Migration Strategy

### 5.1 Restructuring Steps
1.  **Directory Creation**: Generate required directory tree under `/Users/djoker/Documents/ANTIGRAVITY`.
2.  **Web Move**: Relocate root Next.js project files into `apps/web/`.
3.  **API Move**: Relocate NestJS code from `handover_roadmap/wp-control-center-starter/apps/api/` to `apps/api/`.
4.  **Worker Move**: Relocate BullMQ worker code from `handover_roadmap/wp-control-center-starter/apps/worker/` to `apps/worker/`.
5.  **Database Relocation**: Relocate schema and migrations from `handover_roadmap/wp-control-center-starter/packages/database/` to `packages/database/`.
6.  **Agent Move**: Relocate WordPress agent plugin code to `wordpress-agent/`.
7.  **Shared Initialization**: Create the basic structure of `packages/shared/`.
8.  **Config Generation**: Write the root `package.json`, `docker-compose.yml`, and `.env` files.

### 5.2 Verification Checklist
- Run `docker compose up -d` to verify Postgres and Redis containers startup successfully.
- Run `npm install` to resolve all workspaces dependencies.
- Build the database layer by running `npm run db:generate`.
- Verify compilation correctness across the monorepo workspace packages.
