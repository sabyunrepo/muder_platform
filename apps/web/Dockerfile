# Stage 1: Build
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app
# Copy root workspace files first for dependency resolution
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/ packages/
COPY tooling/ tooling/
RUN pnpm install --frozen-lockfile
COPY apps/web/ apps/web/
# Build dependency packages first, then web
RUN pnpm --filter @mmp/shared build && \
    pnpm --filter @mmp/ws-client build && \
    pnpm --filter @mmp/game-logic build && \
    pnpm --filter @mmp/web build

# Stage 2: Serve via Nginx
FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
