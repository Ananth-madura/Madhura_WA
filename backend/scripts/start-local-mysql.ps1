param([string]$ServiceName = 'MySQL80')
$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$logPath = Join-Path $workspace 'scratch/flows-mysql-service.log'
$logDirectory = Split-Path -Parent $logPath
if (-not (Test-Path -LiteralPath $logDirectory)) { New-Item -ItemType Directory -Path $logDirectory | Out-Null }
try {
    if ($ServiceName -ne 'MySQL80') { throw 'This helper only starts the existing MySQL80 service.' }
    $service = Get-Service -Name $ServiceName -ErrorAction Stop
    if ($service.Status -ne 'Running') { Start-Service -Name $ServiceName -ErrorAction Stop }
    $service.WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
    Set-Content -LiteralPath $logPath -Value 'MySQL80 is running. Verify database credentials with check-mysql.js.'
} catch {
    Set-Content -LiteralPath $logPath -Value ('MySQL80 could not start: ' + $_.Exception.Message)
    exit 1
}
