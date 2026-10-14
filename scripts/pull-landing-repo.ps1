# ==============================================================================
# Pull Latest Landing Page from github.com/Ananth-madura/whatsapp_landing.git
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "`n[1/3] Fetching latest commits from landing-repo (whatsapp_landing)..." -ForegroundColor Cyan
git fetch landing-repo main

Write-Host "[2/3] Extracting archive into landing_page/ directory..." -ForegroundColor Cyan
git archive --output=landing.tar landing-repo/main
& "C:\Windows\System32\tar.exe" -xf landing.tar -C landing_page
Remove-Item landing.tar -Force

Write-Host "[3/3] Checking git status..." -ForegroundColor Cyan
git status -s landing_page

Write-Host "`n[OK] Landing page successfully updated from GitHub remote.`n" -ForegroundColor Green
