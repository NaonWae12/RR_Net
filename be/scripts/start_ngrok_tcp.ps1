# Start ngrok TCP tunnel for MikroTik API (port 8728)
# Usage: .\start_ngrok_tcp.ps1 [port]
# Default port: 8728

param(
    [int]$Port = 8728
)

Write-Host "Starting ngrok TCP tunnel on port $Port..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Start ngrok TCP tunnel
ngrok tcp $Port

