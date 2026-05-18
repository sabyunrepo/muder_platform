# Stage 1: Build
FROM public.ecr.aws/docker/library/golang:1.25-alpine AS builder
WORKDIR /build
RUN apk add --no-cache build-base libwebp-dev
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o /app ./cmd/server
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o /migrate-preview ./cmd/migrate-preview

# Stage 2: Runtime (non-root + libwebp runtime for optimized image variants)
FROM public.ecr.aws/docker/library/alpine:3.21
RUN apk add --no-cache ca-certificates libwebp \
    && addgroup -S appuser \
    && adduser -S -G appuser -h /home/appuser -s /sbin/nologin appuser
COPY --from=builder /app /app
COPY --from=builder /migrate-preview /migrate-preview
COPY db/migrations /db/migrations
EXPOSE 8080 9090
USER appuser:appuser
ENTRYPOINT ["/app"]
