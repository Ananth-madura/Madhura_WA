@echo off
title Whatsapp_CRM - MySQL Repair (will ask for admin)
echo.
echo  This will diagnose and repair the MySQL 8.0 service.
echo  It will ask for Administrator permission (UAC prompt).
echo.
pause
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix_mysql.ps1"