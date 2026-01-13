# PowerShell script to run backend with environment variables

# Load environment variables from .env file if exists
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "Loaded .env file" -ForegroundColor Green
} else {
    Write-Host ".env file not found, using system environment variables" -ForegroundColor Yellow
    Write-Host "Creating .env file from template..." -ForegroundColor Yellow
    
    # Set default values
    $env:APP_ENV = "development"
    $env:APP_NAME = "rrnet"
    $env:APP_PORT = "8080"
    $env:DATABASE_URL = "postgres://rrnet:rrnet_secret@localhost:15432/rrnet_dev?sslmode=disable"
    $env:REDIS_ADDR = "localhost:6379"
    $env:REDIS_PASSWORD = ""
    $env:REDIS_DB = "0"
    $env:JWT_SECRET = "dev-secret-key-change-in-production-min-32-characters-long"
    $env:JWT_ACCESS_TTL = "15m"
    $env:JWT_REFRESH_TTL = "7d"
}

# Run the application
Write-Host "Starting backend..." -ForegroundColor Cyan
go run cmd/api/main.go

