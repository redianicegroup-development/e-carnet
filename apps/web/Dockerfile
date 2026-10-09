FROM node:22-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /workspace

# Installer les workspaces avant les sources pour tirer parti du cache Docker.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci

COPY packages/ui packages/ui
COPY apps/web apps/web

WORKDIR /workspace/apps/web
EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=@ecarnet/web"]
