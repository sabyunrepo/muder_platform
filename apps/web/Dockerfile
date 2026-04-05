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
RUN pnpm --filter @mmp/web build

# Stage 2: Serve (local test only; production uses Cloudflare Pages)
FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
ENV PUBLIC_DOMAIN=dev.mystery-place.com
ENV CDN_DOMAIN=https://cdn.mystery-place.com
EXPOSE 80
