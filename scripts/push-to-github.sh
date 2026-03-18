#!/bin/bash

# Script untuk push perubahan ke GitHub
# Usage: ./scripts/push-to-github.sh [commit_message]

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get commit message from argument or use default
COMMIT_MSG="${1:-Update code}"

echo -e "${YELLOW}=== Push to GitHub ===${NC}"

# Check if there are changes
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}No changes to commit.${NC}"
    exit 0
fi

# Show status
echo -e "${GREEN}Current changes:${NC}"
git status --short

# Add all changes
echo -e "\n${GREEN}Adding changes...${NC}"
git add .

# Commit
echo -e "${GREEN}Committing with message: ${COMMIT_MSG}${NC}"
git commit -m "$COMMIT_MSG"

# Push
echo -e "\n${GREEN}Pushing to GitHub...${NC}"
git push origin main

echo -e "\n${GREEN}✓ Successfully pushed to GitHub!${NC}"

