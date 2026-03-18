#!/bin/bash

# Script untuk pull dan deploy di VPS
# Usage: ./scripts/pull-and-deploy.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Pull and Deploy ===${NC}"

# Check if we're in the right directory
if [ ! -d "BE" ]; then
    echo -e "${RED}Error: BE directory not found. Please run from project root.${NC}"
    exit 1
fi

# Pull changes
echo -e "${GREEN}Pulling changes from GitHub...${NC}"
git pull origin main

# Build application
echo -e "\n${GREEN}Building application...${NC}"
cd BE
go build -o rrnet-api cmd/api/main.go

# Check if build succeeded
if [ ! -f "rrnet-api" ]; then
    echo -e "${RED}Error: Build failed!${NC}"
    exit 1
fi

# Restart service
echo -e "\n${GREEN}Restarting service...${NC}"
systemctl restart rrnet-backend

# Wait a bit for service to start
sleep 2

# Check service status
echo -e "\n${GREEN}Checking service status...${NC}"
if systemctl is-active --quiet rrnet-backend; then
    echo -e "${GREEN}✓ Service is running${NC}"
else
    echo -e "${RED}✗ Service failed to start!${NC}"
    echo -e "${YELLOW}Check logs with: journalctl -u rrnet-backend -n 50${NC}"
    exit 1
fi

echo -e "\n${GREEN}✓ Successfully deployed!${NC}"
echo -e "${YELLOW}Check logs with: journalctl -u rrnet-backend -f${NC}"

