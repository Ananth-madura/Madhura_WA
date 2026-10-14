# ==============================================================================
# Madhura WhatsApp CRM - Multi-Repository Synchronization Script
# ==============================================================================
param (
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "   Madhura WhatsApp CRM - Git Multi-Repo Sync" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

$CurrentBranch = (git branch --show-current).Trim()
Write-Host "Current local branch: $CurrentBranch" -ForegroundColor Yellow

# Verify remotes
$Remotes = git remote
$RequiredRemotes = @{
    "monorepo"      = "https://github.com/Ananth-madura/Madhura_WA.git"
    "frontend-repo" = "https://github.com/madhuratech/Madhura-wa-frontend.git"
    "backend-repo"  = "https://github.com/madhuratech/Madhura-wa-backend.git"
    "landing-repo"  = "https://github.com/Ananth-madura/whatsapp_landing.git"
}

foreach ($name in $RequiredRemotes.Keys) {
    if ($Remotes -notcontains $name) {
        Write-Host "Adding missing remote: $name -> $($RequiredRemotes[$name])" -ForegroundColor Green
        git remote add $name $RequiredRemotes[$name]
    }
}

# 1. PUSH MONOREPO
Write-Host "`n[1/4] Pushing to Monorepo (Ananth-madura/Madhura_WA)..." -ForegroundColor Cyan
git push monorepo "${CurrentBranch}:main"
git push monorepo "$CurrentBranch"
Write-Host "[OK] Monorepo synced." -ForegroundColor Green

# 2. PUSH LANDING PAGE
Write-Host "`n[2/4] Splitting and pushing landing_page to Ananth-madura/whatsapp_landing..." -ForegroundColor Cyan
git branch -D split-landing 2>$null
git subtree split --prefix=landing_page -b split-landing
if ($Force) {
    git push landing-repo split-landing:main --force
} else {
    git push landing-repo split-landing:main --force-with-lease 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Re-trying landing push with --force..." -ForegroundColor Yellow
        git push landing-repo split-landing:main --force
    }
}
Write-Host "[OK] Landing Page synced." -ForegroundColor Green

# 3. PUSH FRONTEND
Write-Host "`n[3/4] Splitting and pushing frontend to madhuratech/Madhura-wa-frontend..." -ForegroundColor Cyan
git branch -D split-frontend 2>$null
git subtree split --prefix=frontend -b split-frontend
git push frontend-repo split-frontend:main --force
Write-Host "[OK] Frontend synced." -ForegroundColor Green

# 4. PUSH BACKEND
Write-Host "`n[4/4] Splitting and pushing backend to madhuratech/Madhura-wa-backend..." -ForegroundColor Cyan
git branch -D split-backend 2>$null
git subtree split --prefix=backend -b split-backend
git push backend-repo split-backend:main --force
Write-Host "[OK] Backend synced." -ForegroundColor Green

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "   All 4 repositories have been successfully synced!" -ForegroundColor Green
Write-Host "========================================================`n" -ForegroundColor Green
