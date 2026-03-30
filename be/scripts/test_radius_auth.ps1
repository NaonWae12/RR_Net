param(
  [string]$BaseUrl = "http://localhost:8080",
  [string]$Secret = $env:RRNET_RADIUS_REST_SECRET,
  [string]$NasIp = "1.2.3.4",
  [string]$Username = "TESTVOUCHER001",
  [string]$Password = "ignored",
  [string]$CallingStationId = "AA-BB-CC-DD-EE-FF",
  [string]$CalledStationId = "11-22-33-44-55-66"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Secret)) {
  $Secret = "dev-radius-rest-secret"
}

$uri = "$BaseUrl/api/v1/radius/auth"
$body = @{
  "User-Name" = $Username
  "User-Password" = $Password
  "NAS-IP-Address" = $NasIp
  "NAS-Port-Id" = "hotspot1"
  "Calling-Station-Id" = $CallingStationId
  "Called-Station-Id" = $CalledStationId
} | ConvertTo-Json

Write-Host "POST $uri"
Write-Host "NAS-IP-Address=$NasIp User-Name=$Username"
Write-Host "Using X-RRNET-RADIUS-SECRET=$Secret"
Write-Host ""

try {
  $resp = Invoke-RestMethod -Method Post -Uri $uri -Headers @{ "X-RRNET-RADIUS-SECRET" = $Secret } -ContentType "application/json" -Body $body
  Write-Host "OK (200):"
  $resp | ConvertTo-Json -Depth 10
} catch {
  $ex = $_.Exception
  Write-Host "FAILED:"
  Write-Host $ex.Message

  if ($ex.Response -and $ex.Response.GetResponseStream) {
    try {
      $reader = New-Object System.IO.StreamReader($ex.Response.GetResponseStream())
      $txt = $reader.ReadToEnd()
      if (-not [string]::IsNullOrWhiteSpace($txt)) {
        Write-Host ""
        Write-Host "Response body:"
        Write-Host $txt
      }
    } catch {}
  }

  Write-Host ""
  Write-Host "Common causes:"
  Write-Host "- Wrong secret -> 401 (set RRNET_RADIUS_REST_SECRET)"
  Write-Host "- NAS-IP not registered OR router radius_enabled=false -> 403"
  Write-Host "- Voucher code not found/expired/used -> 401 (with Reply-Message)"
  exit 1
}



