# 1. Build stage
FROM golang:1.25 AS builder
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
# Go mod download usually has better DNS caching/retrying than apk
RUN go mod download

# Copy source code
COPY . .

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o rrnet-api ./cmd/api/main.go

# 2. Final stage (pake Debian-slim yang udah punya library standar)
FROM debian:bookworm-slim
WORKDIR /app

# Update and install iptables WITHOUT cleaning to avoid DNS lookup again if it fails once
# Bookworm-slim already has ca-certificates and tzdata pre-installed
RUN apt-get update && apt-get install -y --no-install-recommends iptables ca-certificates tzdata bash wget && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /app/rrnet-api .

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the application
CMD ["./rrnet-api"]
