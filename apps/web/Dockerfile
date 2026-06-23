FROM node:20-alpine AS builder
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
WORKDIR /app

# Install dependencies (monorepo root)
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/database/package*.json ./packages/database/
RUN npm ci

# Copy source & build
COPY . .
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npm run build -w packages/shared
RUN npm run build -w apps/web

# ── Standalone runner ──────────────────────────────────────
# output: "standalone" produces a self-contained server tree at
#   apps/web/.next/standalone/
#   ├── node_modules/        (minimal, runtime deps only)
#   └── apps/web/server.js   (entry point)
# `.next/static` and `public/` are NOT included by standalone and
# must be layered in next to the server.
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

# Copy the standalone tree. It already contains apps/web/server.js
# and a minimal node_modules/, so we COPY it relative to /.
COPY --from=builder /app/apps/web/.next/standalone ./
# Static chunks (JS/CSS served to the browser)
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
# Public assets (fonts, images, etc.)
COPY --from=builder /app/apps/web/public ./apps/web/public

RUN chown -R node:node /app
USER node
WORKDIR /app/apps/web
EXPOSE 5001
ENV NODE_ENV=production
ENV PORT=5001
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
