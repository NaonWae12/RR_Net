# 1. Build stage
FROM golang:1.25 AS builder
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
# Go mod download usually has better DNS caching/retrying than apk
RUN go mod download

# Copy source code
COPY . .

# Build API binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o rrnet-api ./cmd/api/main.go

# Build Migrate binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o rrnet-migrate ./cmd/migrate/main.go

# 2. Final stage (pake Debian-slim yang udah punya library standar)
FROM debian:bookworm-slim
WORKDIR /app

# Update and install iptables WITHOUT cleaning to avoid DNS lookup again if it fails once
# Bookworm-slim already has ca-certificates and tzdata pre-installed
RUN apt-get update && apt-get install -y --no-install-recommends iptables ca-certificates tzdata bash wget && rm -rf /var/lib/apt/lists/*

# Copy API binary from builder
COPY --from=builder /app/rrnet-api .

# Copy Migrate binary from builder
COPY --from=builder /app/rrnet-migrate .

# Copy migrations folder (needed by migrate binary at runtime)
COPY --from=builder /app/migrations ./migrations

# Entrypoint: run migrations then start API
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run via entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
