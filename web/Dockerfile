# syntax=docker/dockerfile:1.7
# Multi-stage build. Runtime images run as the unprivileged `node` user and contain
# no .env files (see .dockerignore); configuration arrives as environment variables.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# All dependencies, including the Prisma CLI used for migrations.
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# One-shot migration runner: `docker compose run --rm migrate` or started by compose.
FROM deps AS migrate
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

FROM deps AS builder
COPY . .
RUN npm run build

# Background sync worker.
FROM deps AS worker
ENV NODE_ENV=production
COPY --chown=node:node . .
USER node
CMD ["npx", "tsx", "src/worker/sync-worker.ts"]

# Web server: Next.js standalone output only.
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
