FROM node:20-alpine AS builder
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/database/package*.json ./packages/database/
RUN npm ci
COPY . .
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npm run build -w packages/shared
RUN npm run build -w apps/web

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/web/package*.json ./apps/web/
COPY --from=builder /app/packages/shared/package*.json ./packages/shared/
COPY --from=builder /app/packages/database/package*.json ./packages/database/
COPY --from=builder /app/node_modules ./node_modules
# Drop devDependencies to shrink the image and reduce attack surface
RUN npm prune --production
COPY --from=builder /app/apps/web ./apps/web
COPY --from=builder /app/packages/shared ./packages/shared
RUN chown -R node:node /app
# Run as non-root user (built-in in node:alpine)
USER node
EXPOSE 5001
ENV NODE_ENV=production
CMD ["npm", "run", "start", "-w", "apps/web"]
