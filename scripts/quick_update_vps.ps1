# Quick VPS Update - Single SSH Command
# Usage: .\scripts\quick_update_vps.ps1
# When prompted for password, enter: LLaptop7721@

$ErrorActionPreference = "Stop"

$VPS_HOST = "72.60.74.209"
$VPS_USER = "root"
$VPS_PASSWORD = "LLaptop7721@"
$DEPLOY_DIR = "/opt/rrnet"

Write-Host "========================================" -ForegroundColor Green
Write-Host "Quick VPS Update" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "When prompted for password, enter: $VPS_PASSWORD" -ForegroundColor Yellow
Write-Host ""

# Single command that does everything
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" "cd $DEPLOY_DIR && git pull origin main && cd BE && export PATH=\$PATH:/usr/local/go/bin && export GOPATH=/root/go && go mod download && if ! command -v migrate &> /dev/null; then go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest; fi && export PATH=\$PATH:/root/go/bin && if [ -d 'migrations' ]; then migrate -path migrations -database 'postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable' up; fi && cd ../fe && npm install && npm run build && if systemctl is-active --quiet rrnet-backend; then systemctl restart rrnet-backend; elif [ -f '/etc/systemd/system/rrnet-backend.service' ]; then systemctl start rrnet-backend; fi && echo 'Update completed!'"

