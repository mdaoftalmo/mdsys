# apps/backend/Dockerfile
# ═══════════════════════════════════════════════════════════
# Multi-stage production build: NestJS + Prisma + bcrypt
# Image: ~120MB | Build: ~4min cold, <1min cached
# ═══════════════════════════════════════════════════════════

# ── Stage 1: install ALL deps (devDeps needed for build + seed) ──
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci && npx prisma generate

# ── Stage 2: compile TypeScript → dist/ ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json nest-cli.json ./
COPY prisma ./prisma/
COPY src ./src/
RUN npx prisma generate && npm run build

# ── Stage 3: production deps only ──
FROM node:20-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

# ── Stage 4: final runner ──
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder   /app/dist         ./dist
COPY prisma ./prisma/
COPY package.json tsconfig.json ./

# Seed runtime: cherry-pick ts-node + typescript from full deps
# (only ~8MB extra, avoids needing all devDeps at runtime)
COPY --from=deps /app/node_modules/ts-node       ./node_modules/ts-node
COPY --from=deps /app/node_modules/typescript     ./node_modules/typescript
COPY --from=deps /app/node_modules/arg            ./node_modules/arg
COPY --from=deps /app/node_modules/acorn          ./node_modules/acorn
COPY --from=deps /app/node_modules/acorn-walk     ./node_modules/acorn-walk

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER nestjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/main"]
