# ==============================================================================
# Madhura WhatsApp CRM - Multi-Repository Synchronization Script
# ==============================================================================
# Pushes the current branch to:
#   1. Monorepo          -> Ananth-madura/Madhura_WA
#   2. Landing Page      -> madhuratech/wa-landing_page-
#   3. Frontend          -> madhuratech/Madhura-wa-frontend
#   4. Backend           -> madhuratech/Madhura-wa-backend
#
# Usage:
#   .\scripts\sync-all-git-repos.ps1              # validate, push, verify
#   .\scripts\sync-all-git-repos.ps1 -Force       # allow a dirty working tree
#   .\scripts\sync-all-git-repos.ps1 -SkipVerify  # skip the SHA report
# ==============================================================================
param (
    [switch]$Force = $false,
    [switch]$SkipVerify = $false
)

$ErrorActionPreference = "Stop"

$Monorepo = @{
    Name   = "Monorepo"
    Remote = "monorepo"
    Url    = "https://github.com/Ananth-madura/Madhura_WA.git"
}

# Order matters: landing first, then frontend, then backend.
$Subtrees = @(
    @{ Name = "Landing Page"; Prefix = "landing_page"; Remote = "landing-repo"; Url = "https://github.com/madhuratech/wa-landing_page-.git"; Split = "split-landing" },
    @{ Name = "Frontend";     Prefix = "frontend";     Remote = "frontend-repo"; Url = "https://github.com/madhuratech/Madhura-wa-frontend.git"; Split = "split-frontend" },
    @{ Name = "Backend";      Prefix = "backend";      Remote = "backend-repo";  Url = "https://github.com/madhuratech/Madhura-wa-backend.git";  Split = "split-backend" }
)

# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------

# git writes progress and "To <url>" notices to stderr. Keep them off the process
# error stream so this script exits 0 on success instead of tripping PowerShell.
function Test-GitNoise {
    param([string]$Line)
    if ($Line -match '^\s*\d+/\d+ \(\d+\) \[\d+\]') { return $true }   # subtree split progress
    if ($Line -match '^warning: in the working copy') { return $true }  # CRLF notices
    return $false
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [switch]$AllowFailure
    )

    $raw = & git @Arguments 2>&1
    $code = $LASTEXITCODE

    $lines = @($raw | ForEach-Object {
        if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.Exception.Message } else { [string]$_ }
    } | Where-Object { -not (Test-GitNoise $_) })

    if ($code -ne 0 -and -not $AllowFailure) {
        $detail = ($lines | Out-String).Trim()
        throw "git $($Arguments -join ' ') failed (exit $code).`n$detail"
    }

    return $lines
}

function Write-GitOutput {
    param([string[]]$Lines)
    foreach ($line in $Lines) {
        if ($line -and $line.Trim()) { Write-Host "  $line" -ForegroundColor DarkGray }
    }
}

function Ensure-Remote {
    param([string]$Name, [string]$Url)

    $existing = @(Invoke-Git -Arguments @("remote"))
    if ($existing -notcontains $Name) {
        Write-Host "  + adding remote $Name -> $Url" -ForegroundColor Green
        Invoke-Git -Arguments @("remote", "add", $Name, $Url) | Out-Null
        return
    }

    $current = @(Invoke-Git -Arguments @("remote", "get-url", $Name))
    if ($current.Count -gt 0 -and $current[0].Trim() -ne $Url) {
        Write-Host "  ! remote $Name points at $($current[0]) (documented: $Url)" -ForegroundColor Yellow
        Write-Host "    leaving it untouched; run 'git remote set-url $Name $Url' to change it." -ForegroundColor Yellow
    }
}

function Remove-GitBranchSafe {
    param([string]$Branch)

    $existing = @(Invoke-Git -Arguments @("branch", "--list", $Branch))
    if ($existing.Count -gt 0 -and $existing[0].Trim()) {
        Invoke-Git -Arguments @("branch", "-D", $Branch) | Out-Null
    }
}

function Get-RemoteHead {
    param([string]$Remote, [string]$Branch)

    $lines = @(Invoke-Git -Arguments @("ls-remote", "--heads", $Remote, $Branch) -AllowFailure)
    if ($lines.Count -eq 0) { return $null }

    $first = $lines | Where-Object { $_ -and $_.Trim() } | Select-Object -First 1
    if (-not $first) { return $null }
    return ($first -split "`t")[0].Trim()
}

# ------------------------------------------------------------------------------
# Banner
# ------------------------------------------------------------------------------
Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "   Madhura WhatsApp CRM - Git Multi-Repo Sync" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

$CurrentBranch = (@(Invoke-Git -Arguments @("branch", "--show-current")) -join "").Trim()
if (-not $CurrentBranch) {
    throw "Detached HEAD - checkout a branch before syncing."
}
Write-Host "Current local branch: $CurrentBranch" -ForegroundColor Yellow
$LocalHead = (@(Invoke-Git -Arguments @("rev-parse", "HEAD")) -join "").Trim()
Write-Host "Local HEAD:           $LocalHead`n" -ForegroundColor Yellow

# ------------------------------------------------------------------------------
# 1. Validate working tree
# ------------------------------------------------------------------------------
Write-Host "[1/5] Validating working tree..." -ForegroundColor Cyan

$status = @(Invoke-Git -Arguments @("status", "--porcelain"))
$modified = @($status | Where-Object { $_ -and $_.Trim() -and -not $_.StartsWith("??") })
$untracked = @($status | Where-Object { $_ -and $_.StartsWith("??") })

if ($modified.Count -gt 0) {
    Write-Host "  Uncommitted changes detected ($($modified.Count) file(s)):" -ForegroundColor Red
    $modified | Select-Object -First 15 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
    if ($modified.Count -gt 15) { Write-Host "    ... and $($modified.Count - 15) more" -ForegroundColor Red }

    if (-not $Force) {
        Write-Host "`n  Commit or stash your work first, or re-run with -Force." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  -Force supplied: pushing committed history only; these edits stay local.`n" -ForegroundColor Yellow
}

if ($untracked.Count -gt 0) {
    Write-Host "  $($untracked.Count) untracked file(s) ignored (not committed, not pushed)." -ForegroundColor DarkYellow
}

if ($modified.Count -eq 0) {
    Write-Host "  [OK] Tracked files are clean." -ForegroundColor Green
}

# ------------------------------------------------------------------------------
# 2. Push monorepo
# ------------------------------------------------------------------------------
Write-Host "`n[2/5] Pushing to Monorepo (Ananth-madura/Madhura_WA)..." -ForegroundColor Cyan
Ensure-Remote -Name $Monorepo.Remote -Url $Monorepo.Url

Write-GitOutput -Lines @(Invoke-Git -Arguments @("push", $Monorepo.Remote, "${CurrentBranch}:main"))
Write-GitOutput -Lines @(Invoke-Git -Arguments @("push", $Monorepo.Remote, $CurrentBranch))
Write-Host "  [OK] Monorepo synced." -ForegroundColor Green

# ------------------------------------------------------------------------------
# 3-5. Subtree split & push
# ------------------------------------------------------------------------------
$index = 3
foreach ($target in $Subtrees) {
    $label = "{0} -> {1}" -f $target.Prefix, $target.Remote
    Write-Host "`n[$index/5] Splitting and pushing $label..." -ForegroundColor Cyan
    Ensure-Remote -Name $target.Remote -Url $target.Url

    Remove-GitBranchSafe -Branch $target.Split
    Write-GitOutput -Lines @(Invoke-Git -Arguments @("subtree", "split", "--prefix=$($target.Prefix)", "-b", $target.Split))
    Write-GitOutput -Lines @(Invoke-Git -Arguments @("push", $target.Remote, "$($target.Split):main", "--force"))

    $splitHead = (@(Invoke-Git -Arguments @("rev-parse", $target.Split)) -join "").Trim()
    Write-Host "  [OK] $($target.Name) synced at $splitHead" -ForegroundColor Green
    $index++
}

# ------------------------------------------------------------------------------
# 6. Verification report
# ------------------------------------------------------------------------------
if ($SkipVerify) {
    Write-Host "`nVerification skipped (-SkipVerify)." -ForegroundColor Yellow
    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host "   All 4 repositories pushed." -ForegroundColor Green
    Write-Host "========================================================`n" -ForegroundColor Green
    exit 0
}

Write-Host "`n[6/6] Verifying published commit SHAs..." -ForegroundColor Cyan

$report = New-Object System.Collections.Generic.List[object]
$failures = 0

$checks = @(
    @{ Name = "Monorepo (main)"; Remote = $Monorepo.Remote; Branch = "main"; Expected = $LocalHead }
)
foreach ($target in $Subtrees) {
    $checks += @{
        Name     = "$($target.Name) (main)"
        Remote   = $target.Remote
        Branch   = "main"
        Expected = (@(Invoke-Git -Arguments @("rev-parse", $target.Split)) -join "").Trim()
    }
}

foreach ($check in $checks) {
    $actual = Get-RemoteHead -Remote $check.Remote -Branch $check.Branch
    $ok = ($actual -eq ($check.Expected.Trim()))
    if (-not $ok) { $failures++ }
    $report.Add([pscustomobject]@{
        Target   = $check.Name
        Expected = $check.Expected
        Remote   = if ($actual) { $actual } else { "<missing>" }
        Status   = if ($ok) { "OK" } else { "MISMATCH" }
    })
}

$report | Format-Table -AutoSize | Out-String | Write-Host

if ($failures -gt 0) {
    Write-Host "$failures remote(s) do not match the expected SHA." -ForegroundColor Red
    exit 1
}

Write-Host "========================================================" -ForegroundColor Green
Write-Host "   All 4 repositories verified and in sync." -ForegroundColor Green
Write-Host "========================================================`n" -ForegroundColor Green
exit 0
