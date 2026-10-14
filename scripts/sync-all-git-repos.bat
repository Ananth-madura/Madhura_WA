@echo off
title Madhura WhatsApp CRM - Multi-Repo Git Sync
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-all-git-repos.ps1"
pause
