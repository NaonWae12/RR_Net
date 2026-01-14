#!/bin/bash

# RRNET VPS Deployment Script
# Usage: ./scripts/deploy_vps.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# VPS Configuration
VPS_HOST="72.60.74.209"
VPS_USER="root"
VPS_PASSWORD="LLaptop7721@"
DEPLOY_DIR="/opt/rrnet"
GITHUB_REPO="https://github.com/NaonWae12/RR_Net.git"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}RRNET VPS Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if sshpass is installed (for password authentication)
if ! command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}sshpass not found. Installing...${NC}"
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y sshpass
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install hudochenkov/sshpass/sshpass
    else
        echo -e "${RED}Please install sshpass manually for your OS${NC}"
        exit 1
    fi
fi

# Function to run command on VPS
run_remote() {
    sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "$1"
}

# Function to copy file to VPS
copy_to_vps() {
    sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no -r "$1" "$VPS_USER@$VPS_HOST:$2"
}

echo -e "${YELLOW}Step 1: Connecting to VPS and checking system...${NC}"

# Check system info
run_remote "echo '=== System Info ===' && uname -a && free -h && df -h"

echo -e "${YELLOW}Step 2: Installing prerequisites...${NC}"

# Update system and install prerequisites
run_remote "
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq git curl wget build-essential
    apt-get install -y -qq postgresql postgresql-contrib redis-server
    apt-get install -y -qq docker.io docker-compose
    systemctl enable docker
    systemctl start docker
"

echo -e "${YELLOW}Step 3: Installing Go...${NC}"

# Install Go
run_remote "
    if ! command -v go &> /dev/null; then
        cd /tmp
        wget -q https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
        rm -rf /usr/local/go
        tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
        echo 'export PATH=\$PATH:/usr/local/go/bin' >> /root/.bashrc
        export PATH=\$PATH:/usr/local/go/bin
    fi
    go version
"

echo -e "${YELLOW}Step 4: Installing Node.js...${NC}"

# Install Node.js 18+
run_remote "
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y -qq nodejs
    fi
    node --version
    npm --version
"

echo -e "${YELLOW}Step 5: Creating deployment directory...${NC}"

# Create deployment directory
run_remote "
    mkdir -p $DEPLOY_DIR
    cd $DEPLOY_DIR
"

echo -e "${YELLOW}Step 6: Cloning/Updating repository...${NC}"

# Clone or update repository
run_remote "
    cd $DEPLOY_DIR
    if [ -d .git ]; then
        echo 'Repository exists, pulling latest changes...'
        git pull origin main
    else
        echo 'Cloning repository...'
        git clone $GITHUB_REPO .
    fi
"

echo -e "${YELLOW}Step 7: Setting up PostgreSQL...${NC}"

# Setup PostgreSQL
run_remote "
    systemctl enable postgresql
    systemctl start postgresql
    sudo -u postgres psql -c \"CREATE DATABASE rrnet_dev;\" 2>/dev/null || echo 'Database already exists'
    sudo -u postgres psql -c \"CREATE USER rrnet WITH PASSWORD 'rrnet_secret';\" 2>/dev/null || echo 'User already exists'
    sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE rrnet_dev TO rrnet;\" 2>/dev/null || true
    sudo -u postgres psql -c \"ALTER USER rrnet CREATEDB;\" 2>/dev/null || true
"

echo -e "${YELLOW}Step 8: Setting up Redis...${NC}"

# Setup Redis
run_remote "
    systemctl enable redis-server
    systemctl start redis-server
    redis-cli ping
"

echo -e "${YELLOW}Step 9: Building Backend...${NC}"

# Build Backend
run_remote "
    cd $DEPLOY_DIR/BE
    export PATH=\$PATH:/usr/local/go/bin
    export GOPATH=/root/go
    go mod download
    go build -o rrnet-api cmd/api/main.go
    chmod +x rrnet-api
"

echo -e "${YELLOW}Step 10: Setting up Frontend...${NC}"

# Setup Frontend
run_remote "
    cd $DEPLOY_DIR/fe
    npm install
    npm run build
"

echo -e "${YELLOW}Step 11: Creating environment files...${NC}"

# Create .env files
run_remote "
    cd $DEPLOY_DIR/BE
    if [ ! -f .env ]; then
        cat > .env << 'EOF'
APP_ENV=production
APP_NAME=rrnet-api
APP_PORT=8080
DATABASE_URL=postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
JWT_SECRET=change-this-to-secure-random-string-in-production
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
EOF
        echo 'Created BE/.env file'
    else
        echo 'BE/.env already exists'
    fi
"

run_remote "
    cd $DEPLOY_DIR/fe
    if [ ! -f .env.local ]; then
        cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
EOF
        echo 'Created fe/.env.local file'
    else
        echo 'fe/.env.local already exists'
    fi
"

echo -e "${YELLOW}Step 12: Running database migrations...${NC}"

# Run migrations (if migration tool exists, otherwise manual)
run_remote "
    cd $DEPLOY_DIR/BE
    # You may need to run migrations manually or via a migration tool
    echo 'Migrations should be run manually or via migration tool'
"

echo -e "${YELLOW}Step 13: Creating systemd service for backend...${NC}"

# Create systemd service
run_remote "
    cat > /etc/systemd/system/rrnet-backend.service << 'EOF'
[Unit]
Description=RRNET Backend API
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=$DEPLOY_DIR/BE
ExecStart=$DEPLOY_DIR/BE/rrnet-api
Restart=always
RestartSec=10
EnvironmentFile=$DEPLOY_DIR/BE/.env

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable rrnet-backend
"

echo -e "${YELLOW}Step 14: Creating systemd service for frontend...${NC}"

# Create systemd service for frontend
run_remote "
    cat > /etc/systemd/system/rrnet-frontend.service << 'EOF'
[Unit]
Description=RRNET Frontend
After=network.target rrnet-backend.service

[Service]
Type=simple
User=root
WorkingDirectory=$DEPLOY_DIR/fe
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=$DEPLOY_DIR/fe/.env.local

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable rrnet-frontend
"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment completed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Start services:"
echo "   ssh $VPS_USER@$VPS_HOST 'systemctl start rrnet-backend rrnet-frontend'"
echo ""
echo "2. Check status:"
echo "   ssh $VPS_USER@$VPS_HOST 'systemctl status rrnet-backend rrnet-frontend'"
echo ""
echo "3. View logs:"
echo "   ssh $VPS_USER@$VPS_HOST 'journalctl -u rrnet-backend -f'"
echo "   ssh $VPS_USER@$VPS_HOST 'journalctl -u rrnet-frontend -f'"
echo ""
echo -e "${GREEN}Backend will be available at: http://$VPS_HOST:8080${NC}"
echo -e "${GREEN}Frontend will be available at: http://$VPS_HOST:3000${NC}"


