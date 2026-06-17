# WP Control Center Monorepo Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a unified monorepo structure using npm Workspaces, relocate Next.js frontend, copy starter NestJS backend, setup Docker services (Postgres & Redis) on port 3003, and initialize shared packages.

**Architecture:** Create a workspaces-based monorepo directory tree. Move the frontend Next.js app to `apps/web/` and starter services/packages to their respective workspaces directories. Run Postgres and Redis in containers, and manage root configurations for typescript aliases and npm packages.

**Tech Stack:** Next.js (React), NestJS, Prisma ORM, npm Workspaces, Docker Compose, TypeScript.

## Global Constraints
- PORT must be set to 3003.
- Database: PostgreSQL, connection managed by `@wpcc/database` package.
- Queue/Cache: Redis, managed by Docker.
- Package manager: npm workspaces.

---

### Task 1: Monorepo Directory Scaffolding

**Files:**
- Create: `apps/.gitkeep`
- Create: `packages/.gitkeep`

**Interfaces:**
- Consumes: None
- Produces: Base workspaces directory tree

- [ ] **Step 1: Create workspaces directories**

Run:
```bash
mkdir -p apps packages
touch apps/.gitkeep packages/.gitkeep
```
Expected: Folders `apps` and `packages` are created in `/Users/djoker/Documents/ANTIGRAVITY`.

- [ ] **Step 2: Commit**

```bash
git add apps/.gitkeep packages/.gitkeep
git commit -m "chore: setup monorepo app and package workspaces dirs"
```

---

### Task 2: Relocate Next.js Frontend

**Files:**
- Modify: Root Next.js configuration files and assets (moved to `apps/web/`)

**Interfaces:**
- Consumes: Existing Next.js root files
- Produces: `apps/web/` containing the full Next.js project

- [ ] **Step 1: Create apps/web folder and relocate Next.js files**

Run:
```bash
mkdir -p apps/web
# Move directories
mv app apps/web/
mv components apps/web/
mv public apps/web/
mv hooks apps/web/
mv lib apps/web/
# Move files
mv next-env.d.ts apps/web/
mv next.config.ts apps/web/
mv tsconfig.json apps/web/
mv components.json apps/web/
mv postcss.config.mjs apps/web/
mv eslint.config.mjs apps/web/
mv .prettierignore apps/web/
mv .prettierrc apps/web/
```
Expected: The files and folders are moved to `apps/web`.

- [ ] **Step 2: Relocate package.json and package-lock.json**

Run:
```bash
mv package.json apps/web/
mv package-lock.json apps/web/
```

- [ ] **Step 3: Modify package.json in apps/web**

Update `apps/web/package.json` to change the name to `"web"` and configure local paths if needed:
```json
{
  "name": "web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "refactor: relocate Next.js frontend to apps/web"
```

---

### Task 3: Relocate Backend, Worker and Database Skeletons

**Files:**
- Create: `apps/api/` (content from `handover_roadmap/wp-control-center-starter/apps/api`)
- Create: `apps/worker/` (content from `handover_roadmap/wp-control-center-starter/apps/worker`)
- Create: `packages/database/` (content from `handover_roadmap/wp-control-center-starter/packages/database`)
- Create: `wordpress-agent/` (content from `handover_roadmap/wp-control-center-starter/wordpress-agent`)

**Interfaces:**
- Consumes: Skeleton code in `handover_roadmap/wp-control-center-starter/`
- Produces: Backend NestJS code, Worker code, Prisma DB package, and WP Agent plugin inside respective workspace directories.

- [ ] **Step 1: Copy NestJS API skeleton**

Run:
```bash
cp -r handover_roadmap/wp-control-center-starter/apps/api apps/
```
Expected: Folder `apps/api` is created containing the source code.

- [ ] **Step 2: Copy Worker skeleton**

Run:
```bash
cp -r handover_roadmap/wp-control-center-starter/apps/worker apps/
```
Expected: Folder `apps/worker` is created.

- [ ] **Step 3: Copy Database schema package**

Run:
```bash
cp -r handover_roadmap/wp-control-center-starter/packages/database packages/
```
Expected: Folder `packages/database` is created.

- [ ] **Step 4: Copy WordPress Agent Plugin**

Run:
```bash
cp -r handover_roadmap/wp-control-center-starter/wordpress-agent ./
```
Expected: Folder `wordpress-agent` is created in the workspace root.

- [ ] **Step 5: Commit**

```bash
git add apps/api apps/worker packages/database wordpress-agent
git commit -m "chore: relocate API, worker, database, and wordpress agent starter skeletons"
```

---

### Task 4: Root Configuration & Shared Packages Initialization

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/index.ts`
- Create: `package.json` (at root)
- Create: `docker-compose.yml` (at root)
- Create: `.env` (at root)
- Create: `.env.example` (at root)
- Create: `tsconfig.json` (at root)

**Interfaces:**
- Consumes: None
- Produces: Shared npm workspace packages and docker orchestration environment configurations.

- [ ] **Step 1: Write packages/shared package.json**

Create `packages/shared/package.json`:
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

- [ ] **Step 2: Write packages/shared index.ts**

Create `packages/shared/src/index.ts`:
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

- [ ] **Step 3: Write root package.json**

Create `package.json` at the root of the workspace:
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

- [ ] **Step 4: Write docker-compose.yml**

Create `docker-compose.yml` at the root of the workspace:
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

- [ ] **Step 5: Write root .env and .env.example**

Create `.env` at the root:
```env
NODE_ENV=development
PORT=3003

DATABASE_URL="postgresql://postgres:SecretPassword123!@localhost:5432/wp_control_center?schema=public"

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET="super-secret-jwt-key-replace-in-production"
JWT_EXPIRES_IN="1d"

AGENT_ENCRYPTION_KEY="6a66632c253d82a17cb0b51de38e8cb554c8651a24d852a35368a5436d4f9bf3"

UPTIME_CHECK_INTERVAL_SECONDS=300
```
Run:
```bash
cp .env .env.example
```

- [ ] **Step 6: Write root tsconfig.json**

Create `tsconfig.json` at the root:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@wpcc/database": ["packages/database/src/index.ts"],
      "@wpcc/shared": ["packages/shared/src/index.ts"]
    }
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/shared package.json docker-compose.yml .env .env.example tsconfig.json
git commit -m "chore: initialize shared package and global config files"
```

---

### Task 5: Installation & Verification

**Files:**
- Create: `packages/database/prisma/client` (via generator)

**Interfaces:**
- Consumes: Existing Prisma schema file
- Produces: Installed npm packages and functional Prisma client

- [ ] **Step 1: Install workspace packages**

Run:
```bash
npm install
```
Expected: Node modules are installed under root directory, and local workspaces are linked.

- [ ] **Step 2: Start docker services**

Run:
```bash
docker compose up -d
```
Expected: Postgres and Redis containers start successfully.

- [ ] **Step 3: Run Prisma Client generator**

Run:
```bash
npm run db:generate
```
Expected: Prisma client generation succeeds.

- [ ] **Step 4: Run database migration and seed**

Run:
```bash
npm run db:migrate --name init
npm run db:seed
```
Expected: Database is populated with default seed values.

- [ ] **Step 5: Verify build**

Run:
```bash
npm run build:all
```
Expected: All workspaces packages compile successfully.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: setup dependencies and initialize postgres database seed"
```
