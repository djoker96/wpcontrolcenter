FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/database/package*.json ./packages/database/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci
COPY . .
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npm run build -w packages/database
RUN npm run build -w packages/shared
RUN npm run build -w apps/api

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/api/package*.json ./apps/api/
COPY --from=builder /app/packages/database/package*.json ./packages/database/
COPY --from=builder /app/packages/shared/package*.json ./packages/shared/
COPY --from=builder /app/node_modules ./node_modules
# Drop devDependencies to shrink the image and reduce attack surface
RUN npm prune --production
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/packages/shared ./packages/shared
# Create a writable storage dir owned by the non-root user
RUN mkdir -p /app/storage/backups && chown -R node:node /app
# Run as non-root user (built-in in node:alpine)
USER node
EXPOSE 3003
ENV NODE_ENV=production
CMD ["npm", "run", "start:prod", "-w", "apps/api"]
