param(
  [string]$BaseUrl = "http://localhost:8080",
  [string]$Secret = $env:RRNET_RADIUS_REST_SECRET,
  [string]$NasIp = "1.2.3.4",
  [string]$Username = "TESTVOUCHER001",
  [ValidateSet("Start","Interim-Update","Stop")]
  [string]$StatusType = "Start",
  [string]$AcctSessionId = "sess-001",
  [int]$AcctSessionTime = 0,
  [long]$InputOctets = 0,
  [long]$OutputOctets = 0
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Secret)) {
  $Secret = "dev-radius-rest-secret"
}

$uri = "$BaseUrl/api/v1/radius/acct"
$body = @{
  "Acct-Status-Type" = $StatusType
  "Acct-Session-Id" = $AcctSessionId
  "User-Name" = $Username
  "NAS-IP-Address" = $NasIp
  "NAS-Port-Id" = "hotspot1"
  "Framed-IP-Address" = "10.10.10.10"
  "Calling-Station-Id" = "AA-BB-CC-DD-EE-FF"
  "Called-Station-Id" = "11-22-33-44-55-66"
  "Acct-Session-Time" = $AcctSessionTime
  "Acct-Input-Octets" = $InputOctets
  "Acct-Output-Octets" = $OutputOctets
  "Acct-Input-Packets" = 0
  "Acct-Output-Packets" = 0
  "Acct-Terminate-Cause" = ""
} | ConvertTo-Json

Write-Host "POST $uri"
Write-Host "Acct-Status-Type=$StatusType NAS-IP-Address=$NasIp User-Name=$Username Acct-Session-Id=$AcctSessionId"
Write-Host ""

try {
  Invoke-WebRequest -Method Post -Uri $uri -Headers @{ "X-RRNET-RADIUS-SECRET" = $Secret } -ContentType "application/json" -Body $body | Out-Null
  Write-Host "OK (204 No Content)"
} catch {
  $ex = $_.Exception
  Write-Host "FAILED:"
  Write-Host $ex.Message
  exit 1
}



