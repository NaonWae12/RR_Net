# RRNET VPS Deployment Script (PowerShell)
# Usage: .\scripts\deploy_vps.ps1

$ErrorActionPreference = "Stop"

# VPS Configuration
$VPS_HOST = "72.60.74.209"
$VPS_USER = "root"
$VPS_PASSWORD = "LLaptop7721@"
$DEPLOY_DIR = "/opt/rrnet"
$GITHUB_REPO = "https://github.com/NaonWae12/RR_Net.git"

Write-Host "========================================" -ForegroundColor Green
Write-Host "RRNET VPS Deployment Script" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Check if plink (PuTTY) or ssh is available
$hasSSH = Get-Command ssh -ErrorAction SilentlyContinue
$hasPlink = Get-Command plink -ErrorAction SilentlyContinue

if (-not $hasSSH -and -not $hasPlink) {
    Write-Host "SSH client not found. Please install:" -ForegroundColor Red
    Write-Host "1. OpenSSH (Windows 10+): Add-WindowsCapability -Online -Name OpenSSH.Client" -ForegroundColor Yellow
    Write-Host "2. Or install PuTTY" -ForegroundColor Yellow
    exit 1
}

# Function to run command on VPS using SSH
function Run-RemoteCommand {
    param([string]$Command)
    
    if ($hasSSH) {
        $env:SSH_PASSWORD = $VPS_PASSWORD
        ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" $Command
    } else {
        # Using plink with password
        echo y | plink -ssh -pw $VPS_PASSWORD "$VPS_USER@$VPS_HOST" $Command
    }
}

Write-Host "`nStep 1: Connecting to VPS and checking system..." -ForegroundColor Yellow
Run-RemoteCommand "echo '=== System Info ===' && uname -a && free -h && df -h"

Write-Host "`nStep 2: Installing prerequisites..." -ForegroundColor Yellow
Run-RemoteCommand @"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl wget build-essential
apt-get install -y -qq postgresql postgresql-contrib redis-server
apt-get install -y -qq docker.io docker-compose
systemctl enable docker
systemctl start docker
"@

Write-Host "`nStep 3: Installing Go..." -ForegroundColor Yellow
Run-RemoteCommand @"
if ! command -v go &> /dev/null; then
    cd /tmp
    wget -q https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
    echo 'export PATH=\$PATH:/usr/local/go/bin' >> /root/.bashrc
    export PATH=\$PATH:/usr/local/go/bin
fi
go version
"@

Write-Host "`nStep 4: Installing Node.js..." -ForegroundColor Yellow
Run-RemoteCommand @"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y -qq nodejs
fi
node --version
npm --version
"@

Write-Host "`nStep 5: Creating deployment directory..." -ForegroundColor Yellow
Run-RemoteCommand "mkdir -p $DEPLOY_DIR && cd $DEPLOY_DIR"

Write-Host "`nStep 6: Cloning/Updating repository..." -ForegroundColor Yellow
Run-RemoteCommand @"
cd $DEPLOY_DIR
if [ -d .git ]; then
    echo 'Repository exists, pulling latest changes...'
    git pull origin main
else
    echo 'Cloning repository...'
    git clone $GITHUB_REPO .
fi
"@

Write-Host "`nStep 7: Setting up PostgreSQL..." -ForegroundColor Yellow
Run-RemoteCommand @"
systemctl enable postgresql
systemctl start postgresql
sudo -u postgres psql -c \"CREATE DATABASE rrnet_dev;\" 2>/dev/null
sudo -u postgres psql -c \"CREATE USER rrnet WITH PASSWORD 'rrnet_secret';\" 2>/dev/null
sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE rrnet_dev TO rrnet;\" 2>/dev/null
sudo -u postgres psql -c \"ALTER USER rrnet CREATEDB;\" 2>/dev/null
"@

Write-Host "`nStep 8: Setting up Redis..." -ForegroundColor Yellow
Run-RemoteCommand "systemctl enable redis-server && systemctl start redis-server && redis-cli ping"

Write-Host "`nStep 9: Building Backend..." -ForegroundColor Yellow
Run-RemoteCommand @"
cd $DEPLOY_DIR/BE
export PATH=\$PATH:/usr/local/go/bin
export GOPATH=/root/go
go mod download
go build -o rrnet-api cmd/api/main.go
chmod +x rrnet-api
"@

Write-Host "`nStep 10: Setting up Frontend..." -ForegroundColor Yellow
Run-RemoteCommand "cd $DEPLOY_DIR/fe && npm install && npm run build"

Write-Host "`nStep 11: Creating environment files..." -ForegroundColor Yellow
Run-RemoteCommand @"
cd $DEPLOY_DIR/BE
if [ ! -f .env ]; then
    cat > .env << 'ENVEOF'
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
ENVEOF
    echo 'Created BE/.env file'
fi
"@

Run-RemoteCommand @"
cd $DEPLOY_DIR/fe
if [ ! -f .env.local ]; then
    echo 'NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1' > .env.local
    echo 'Created fe/.env.local file'
fi
"@

Write-Host "`nStep 12: Creating systemd services..." -ForegroundColor Yellow

# Backend service
$backendService = @"
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
"@

# Save to temp file and copy
$tempFile = [System.IO.Path]::GetTempFileName()
$backendService | Out-File -FilePath $tempFile -Encoding utf8

if ($hasSSH) {
    scp -o StrictHostKeyChecking=no $tempFile "$VPS_USER@$VPS_HOST`:/tmp/rrnet-backend.service"
    Run-RemoteCommand "mv /tmp/rrnet-backend.service /etc/systemd/system/rrnet-backend.service && systemctl daemon-reload && systemctl enable rrnet-backend"
} else {
    Write-Host "Please manually create systemd service files on VPS" -ForegroundColor Yellow
}

Remove-Item $tempFile

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Deployment completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. SSH to VPS: ssh $VPS_USER@$VPS_HOST" -ForegroundColor Cyan
Write-Host "2. Start services: systemctl start rrnet-backend" -ForegroundColor Cyan
Write-Host "3. Check status: systemctl status rrnet-backend" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend: http://$VPS_HOST`:8080" -ForegroundColor Green
Write-Host "Frontend: http://$VPS_HOST`:3000" -ForegroundColor Green


