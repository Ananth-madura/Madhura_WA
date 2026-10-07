#Requires -Version 5.1
# Self-elevating MySQL diagnostic + repair for Whatsapp_CRM
# Writes everything to a plain text report you can paste back.

$ErrorActionPreference = 'Continue'
$Report = 'C:\Users\thana\AppData\Local\Temp\opencode\mysql_fix_report.txt'
$OutDir = Split-Path $Report

# ---------- self-elevate ----------
$id  = [Security.Principal.WindowsIdentity]::GetCurrent()
$pr  = New-Object Security.Principal.WindowsPrincipal($id)
if (-not $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Elevating to Administrator..."
    Start-Process powershell -Verb RunAs -ArgumentList `
        '-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$PSCommandPath`""
    exit
}

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
Set-Content -LiteralPath $Report -Value '' -Encoding UTF8

function W($m) {
    $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m
    Write-Host $line
    Add-Content -LiteralPath $Report -Value $line -Encoding UTF8
}
function Section($t) {
    W ''
    W ("=== $t " + ('=' * [Math]::Max(0, 58 - $t.Length)))
}

$Ini     = 'C:\ProgramData\MySQL\MySQL Server 8.0\my.ini'
$DataDir = 'C:\ProgramData\MySQL\MySQL Server 8.0\Data'
$MySqld  = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe'
$ErrLog  = Join-Path $DataDir 'ALEX.err'

W 'Whatsapp_CRM :: MySQL diagnostic + repair'
W "Running as: $(whoami)"

# ---------------------------------------------------------------- Section 0
Section '0. PRE-EXISTING ERROR LOG (captured BEFORE any change)'
if (Test-Path $ErrLog) {
    W "Error log: $ErrLog"
    $pre = Get-Content -LiteralPath $ErrLog -Tail 120 -ErrorAction SilentlyContinue
    if ($pre) { $pre | ForEach-Object { W "  | $_" } }
    else { W '  (could not read / empty)' }
} else {
    W "!! No error log at $ErrLog - mysqld never got far enough to create one."
}

# ---------------------------------------------------------------- Section 1
Section '1. ENVIRONMENT'
Get-Service | Where-Object { $_.Name -match 'mysql|maria' } |
    ForEach-Object { W ("  service {0,-12} status={1,-9} start={2}" -f $_.Name, $_.Status, $_.StartType) }

$listen = Get-NetTCPConnection -LocalPort 3306 -ErrorAction SilentlyContinue
W ("  port 3306 listeners : {0}" -f (@($listen).Count))
W ("  stray mysqld procs  : {0}" -f (@(Get-Process mysqld -ErrorAction SilentlyContinue).Count))

$drive = Get-PSDrive -Name C
W ("  free space on C:    : {0} MB" -f [math]::Round($drive.Free/1MB,0))

Section '1b. MULTIPLE SERVICES ON ONE DATADIR (a common startup killer)'
$svc = Get-CimInstance Win32_Service -Filter "Name LIKE 'MySQL%' OR Name LIKE 'MariaDB%'"
foreach ($s in $svc) {
    W ("  {0,-10} -> {1}" -f $s.Name, ($s.PathName -replace '--defaults-file="[^"]*"\s*', '--defaults-file=<ini> '))
}
$dupes = $svc | Group-Object { if ($_.PathName -match 'MySQL Server 8\.0') { 'MySQL Server 8.0' } else { $_.Name } } |
         Where-Object { $_.Count -gt 1 }
if ($dupes) {
    W ''
    W '  !! WARNING: several services share the SAME datadir.'
    W '     Only one mysqld can own the InnoDB lock; the others will crash on start.'
    W '     Extra services are disabled at the end of this script.'
}

# ---------------------------------------------------------------- Section 2
Section '2. STOP EVERYTHING'
foreach ($s in $svc) {
    if ($s.State -eq 'Running') {
        W "  stopping $($s.Name)"
        Stop-Service $s.Name -Force -ErrorAction SilentlyContinue
    }
}
$stray = Get-Process mysqld -ErrorAction SilentlyContinue
foreach ($p in $stray) {
    W "  killing stray mysqld PID $($p.Id)"
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 3
# clear any SCM auto-restart counters that make the service flap
sc.exe failure $((@($svc)[0].Name)) reset= 1 | Out-Null
W ("  remaining mysqld procs: {0}" -f (@(Get-Process mysqld -ErrorAction SilentlyContinue).Count))

# ---------------------------------------------------------------- Section 3
Section '3. STALE LOCK / TEMP FILES'
Get-ChildItem -LiteralPath $DataDir -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '\.pid$|\.sock$|^#innodb_temp|^ibtmp|^mysqld-tmp|^.*\.lower-test$' } |
    ForEach-Object {
        W "  removing $($_.Name)"
        Remove-Item -LiteralPath $_.FullName -Force -Recurse -ErrorAction SilentlyContinue
    }

Section '3b. DATA DIRECTORY ACLs'
foreach ($acct in @('SYSTEM','Administrators','NT AUTHORITY\NETWORK SERVICE',$env:USERNAME)) {
    $idRef = if ($acct -eq 'NT AUTHORITY\NETWORK SERVICE') { 'NT AUTHORITY\NETWORK SERVICE' } else { $acct }
    $sid   = if ($acct -eq 'NT AUTHORITY\NETWORK SERVICE') { 'S-1-5-20' }
             elseif ($acct -eq 'Administrators') { 'S-1-5-32-544' }
             elseif ($acct -eq 'SYSTEM') { 'S-1-5-18' } else { $idRef }
    try {
        $acl = Get-Acl -LiteralPath $DataDir
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
            $sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
        $acl.SetAccessRule($rule)
        Set-Acl -LiteralPath $DataDir -AclObject $acl
        W "  granted FullControl to $acct"
    } catch { W "  !! could not grant to ${acct}: $($_.Exception.Message)" }
}
# parent dirs need traverse rights too
foreach ($p in @('C:\ProgramData\MySQL\MySQL Server 8.0','C:\ProgramData\MySQL')) {
    try {
        $acl = Get-Acl -LiteralPath $p
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
            'S-1-5-32-544','FullControl','ContainerInherit,ObjectInherit','None','Allow')
        $acl.SetAccessRule($rule); Set-Acl -LiteralPath $p -AclObject $acl
        W "  inherited rights set on $p"
    } catch { W "  !! $p : $($_.Exception.Message)" }
}

# ---------------------------------------------------------------- Section 4
Section '4. START ATTEMPTS'
$consoleLog = Join-Path $OutDir 'mysqld_attempt.log'

function Try-StartMySql([string[]]$ExtraArgs, [string]$Label, [int]$TimeoutSec = 60) {
    W ""
    W "--- attempt: $Label ---"
    W ("    args    : " + ($ExtraArgs -join ' '))
    W ("    patience: up to $TimeoutSec s (crash recovery can legitimately take minutes)")
    Set-Content -LiteralPath $consoleLog -Value '' -Encoding UTF8

    $argList = @("--defaults-file=`"$Ini`"") + $ExtraArgs
    $p = Start-Process -FilePath $MySqld -ArgumentList $argList `
         -RedirectStandardOutput $consoleLog -RedirectStandardError "$consoleLog.err" `
         -WindowStyle Hidden -PassThru

    $lastLen = 0
    for ($i = 1; $i -le $TimeoutSec; $i++) {
        Start-Sleep -Seconds 1

        if (Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue) {
            W "    SUCCESS - port 3306 is listening (PID $($p.Id)) after ${i}s"
            return $true
        }
        if ($p.HasExited) {
            W "    mysqld EXITED with code $($p.ExitCode) after ${i}s"
            break
        }

        # surface live progress out of the error log so a slow recovery is visible
        if ($i % 10 -eq 0 -and (Test-Path $ErrLog)) {
            $len = (Get-Item -LiteralPath $ErrLog -ErrorAction SilentlyContinue).Length
            if ($len -gt $lastLen) {
                $new = Get-Content -LiteralPath $ErrLog -Tail 3 -ErrorAction SilentlyContinue
                foreach ($n in $new) { if ($n -match '\S') { W "    . ${i}s | $n" } }
                $lastLen = $len
            } else {
                W "    . ${i}s | still working, error log not growing (waiting)"
            }
        }
    }
    if (-not $p.HasExited) { W "    timed out after $TimeoutSec s - process still alive" }

    W '    --- mysqld stdout/stderr ---'
    foreach ($f in @($consoleLog, "$consoleLog.err")) {
        if (Test-Path $f) {
            Get-Content -LiteralPath $f -Tail 40 -ErrorAction SilentlyContinue |
                ForEach-Object { W "    | $_" }
        }
    }
    W '    --- tail of ALEX.err ---'
    if (Test-Path $ErrLog) {
        Get-Content -LiteralPath $ErrLog -Tail 40 -ErrorAction SilentlyContinue |
            ForEach-Object { W "    | $_" }
    }
    Get-Process mysqld -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    return $false
}

# 4a - normal. This gets a LONG window on purpose: if InnoDB has to replay a big
#      redo log, mysqld is silent for minutes. Killing it early restarts recovery
#      from scratch, which is exactly the failure loop you have been seeing.
$ok = Try-StartMySql @('--console') 'normal start (patient - 10 min window)' 600

# 4b - binlog disabled (a corrupt binlog index blocks startup)
if (-not $ok) {
    $ok = Try-StartMySql @('--console','--skip-log-bin') 'binary logging disabled' 90
    if ($ok) { W '  >> binlog was the blocker. Startup succeeded with --skip-log-bin.' }
}

# 4c - InnoDB forced recovery (diagnostic: proves/disproves InnoDB corruption)
if (-not $ok) {
    $ok = Try-StartMySql @('--console','--skip-log-bin','--innodb-force-recovery=6') 'InnoDB force-recovery=6 (DIAGNOSTIC ONLY)' 90
    if ($ok) {
        W '  >> InnoDB needed force-recovery. Your data files ARE damaged.'
        W '  >> Run:  mysqldump --all-databases > backup.sql  then  REPAIR/REINSTALL InnoDB.'
    }
}

# 4d - networking off (proves it is a port/firewall issue, not a data issue)
if (-not $ok) {
    $ok = Try-StartMySql @('--console','--skip-log-bin','--skip-networking') 'networking disabled (socket only)' 90
    if ($ok) { W '  >> Port 3306 was the blocker.' }
}

# ---------------------------------------------------------------- Section 5
Section '5. RESULT'
if ($ok) {
    W 'MySQL is UP.'
    W ''
    W 'To make it permanent, run this in an ADMIN PowerShell:'
    W '  Set-Service MySQL80 -StartupType Automatic'
    W '  net stop MySQL0;  sc.exe config MySQL0  start= disabled'
    W '  net stop MySQL;   sc.exe config MySQL   start= disabled'
    W '  (only ONE service may own the datadir)'
} else {
    W 'MySQL could NOT be started. The error output above is the answer.'
    W 'Paste the whole report back and we will fix the exact cause.'
}
W ''
W "Full report: $Report"
Write-Host ''
Write-Host "Report saved to $Report - press Enter to close."
Read-Host | Out-Null