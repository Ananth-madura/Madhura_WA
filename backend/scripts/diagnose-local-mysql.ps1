$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$report = Join-Path $workspace 'scratch/flows-mysql-diagnostic.log'
$stdout = Join-Path $workspace 'scratch/flows-mysql-normal-output.log'
$stderr = Join-Path $workspace 'scratch/flows-mysql-normal-errors.log'
$service = Get-Service -Name MySQL80
if ($service.Status -eq 'Running') { Set-Content -LiteralPath $report -Value 'MySQL80 is already running.'; exit }
try {
    $dataDirectory = 'C:\ProgramData\MySQL\MySQL Server 8.0\Data'
    $lines = @('Existing data-directory access rules:')
    $lines += (Get-Acl -LiteralPath $dataDirectory).Access | ForEach-Object { '{0}: {1} ({2})' -f $_.IdentityReference,$_.FileSystemRights,$_.AccessControlType }
    Set-Content -LiteralPath $report -Value $lines
    $mysqlProcess = Start-Process -FilePath 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe' -WindowStyle Hidden -ArgumentList @('--defaults-file="C:\ProgramData\MySQL\MySQL Server 8.0\my.ini"','--console') -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    Add-Content -LiteralPath $report -Value ('Normal startup process: ' + $mysqlProcess.Id)
} catch { Add-Content -LiteralPath $report -Value ('Diagnostic failed: ' + $_.Exception.Message); exit 1 }
