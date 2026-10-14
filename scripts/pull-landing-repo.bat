@echo off
title Pull Latest Landing Page
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pull-landing-repo.ps1"
pause
