# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci

FROM node:22-bookworm-slim AS builder
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /workspace
COPY --from=deps /workspace/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/ui packages/ui
COPY apps/web apps/web
ARG ECARNET_API_ORIGIN=http://api:8000
ENV ECARNET_API_ORIGIN=${ECARNET_API_ORIGIN}
RUN npm run build --workspace=@ecarnet/web

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
WORKDIR /app
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
