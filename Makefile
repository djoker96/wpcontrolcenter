SHELL := /bin/bash
.PHONY: setup dev dev-web dev-api dev-worker build db-migrate db-seed db-reset db-generate lint typecheck test help

DB_ENV = set -a && source .env && set +a

# ── Setup ──────────────────────────────────────────────────────────────────────
setup: ## Install deps, generate DB client, run migrations, seed
	bun install
	cd packages/database && bunx prisma generate
	$(DB_ENV) && cd packages/database && bunx prisma migrate dev
	$(DB_ENV) && cd packages/database && bun run seed
	@echo "Setup complete. Run 'make dev' to start."

# ── Dev ────────────────────────────────────────────────────────────────────────
dev: ## Start all services (web + api + worker) concurrently
	bun run dev:api & bun run dev:worker & bun run dev:web

dev-web: ## Start Next.js web only (localhost:5001)
	bun run dev:web

dev-api: ## Start NestJS API only
	bun run dev:api

dev-worker: ## Start BullMQ worker only
	bun run dev:worker

# ── Build ──────────────────────────────────────────────────────────────────────
build: ## Build all apps and packages
	bun run build:all

# ── Database ───────────────────────────────────────────────────────────────────
db-migrate: ## Run Prisma migrations (dev)
	$(DB_ENV) && cd packages/database && bunx prisma migrate dev

db-seed: ## Seed database
	$(DB_ENV) && cd packages/database && bun run seed

db-reset: ## Drop, migrate, and re-seed database
	$(DB_ENV) && cd packages/database && bunx prisma migrate reset --force

db-generate: ## Regenerate Prisma client
	cd packages/database && bunx prisma generate

# ── Quality ────────────────────────────────────────────────────────────────────
lint: ## Lint all apps
	cd apps/api && bun run lint
	cd apps/web && bun run lint

typecheck: ## Type-check all apps
	cd apps/api && bun run typecheck
	cd apps/web && bun run typecheck

test: ## Run tests
	cd apps/api && bun run test

# ── Help ───────────────────────────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
