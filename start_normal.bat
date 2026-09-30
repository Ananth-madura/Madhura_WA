@echo off
setlocal EnableDelayedExpansion
title Whatsapp_CRM - Quickstart Launcher
color 0A

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

echo =====================================================
echo        WHATSAPP_CRM - QUICKSTART LAUNCHER
echo        [standalone WhatsApp service]
echo =====================================================
echo.

:: ---- Step 1: Check Node.js ----
echo [1/7] Checking Node.js runtime...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo [FAIL] Node.js is NOT installed or not in system PATH.
    echo.
    echo Please install Node.js LTS from: https://nodejs.org
    echo After installing, re-run this launcher.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version 2^>nul') do set "NODE_VER=%%v"
echo [OK]   Node.js %NODE_VER% detected.
echo.

:: ---- Step 2: Check MySQL Database ----
echo [2/7] Checking MySQL Database status...
set "MYSQL_ACTIVE=0"
netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 set "MYSQL_ACTIVE=1"

if "%MYSQL_ACTIVE%"=="0" (
    echo [INFO] MySQL is not running on port 3306. Attempting to start service...
    net start MySQL80 >nul 2>&1
    net start MySQL >nul 2>&1
    net start MySQL84 >nul 2>&1
    net start MySQL57 >nul 2>&1
    net start MySQL90 >nul 2>&1
    net start mysql >nul 2>&1
    net start MariaDB >nul 2>&1

    ping -n 4 127.0.0.1 >nul
    netstat -ano | findstr ":3306 " | findstr "LISTENING" >nul 2>&1
    if not errorlevel 1 set "MYSQL_ACTIVE=1"
)

if "%MYSQL_ACTIVE%"=="1" (
    echo [OK]   MySQL is running on port 3306.
) else (
    echo [WARN] MySQL is not detected on port 3306.
    echo        Please ensure MySQL Server or XAMPP is running if database connection fails.
)
echo.

:: ---- Step 2b: Database info ----
echo [2b/7] Checking achme_wa database configuration...
echo        Target database: "achme_wa" on port 3306.
echo        Auto-configuration will run in Step 4b using Node.js.
echo.

:: ---- Step 3: Ensure Directories & Environment Files ----
echo [3/7] Verifying project directories and configuration...
if not exist "%ROOT%\backend\uploads" mkdir "%ROOT%\backend\uploads"
if not exist "%ROOT%\backend\uploads\wa-media" mkdir "%ROOT%\backend\uploads\wa-media"
if not exist "%ROOT%\whatsapp-sessions" mkdir "%ROOT%\whatsapp-sessions"
if not exist "%ROOT%\logs" mkdir "%ROOT%\logs"

if not exist "%ROOT%\backend\.env" (
    echo [INFO] Backend .env not found. Creating from template...
    if exist "%ROOT%\backend\.env.example" (
        copy "%ROOT%\backend\.env.example" "%ROOT%\backend\.env" >nul
        echo [OK]   Backend .env created from .env.example.
    ) else (
        echo [FAIL] backend\.env.example is missing. Re-clone the repo via git pull and retry.
        pause
        exit /b 1
    )
) else (
    echo [OK]   Backend .env found.
)

:: Detect LAN IP
set "LAN_IP=127.0.0.1"
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /R /C:"IPv4 Address" ^| findstr /V "127\.0\." ^| findstr /V "169\.254\."') do (
    set "CANDIDATE=%%i"
    set "CANDIDATE=!CANDIDATE: =!"
    if not "!CANDIDATE!"=="" (
        if "!LAN_IP!"=="127.0.0.1" set "LAN_IP=!CANDIDATE!"
    )
)

(
echo PORT=3001
echo REACT_APP_API_URL=http://!LAN_IP!:5001
) > "%ROOT%\frontend\.env"
echo [OK]   Frontend .env set to port 3001 and backend http://!LAN_IP!:5001.
echo.

:: ---- Step 4: Check and Install Dependencies ----
echo [4/7] Checking dependencies...
if not exist "%ROOT%\backend\node_modules" (
    echo [INFO] Installing backend dependencies - please wait...
    cd /d "%ROOT%\backend"
    call npm install --legacy-peer-deps
    if exist "%ROOT%\backend\patches" (
        call npx patch-package >nul 2>&1
    )
    echo [OK]   Backend dependencies installed.
) else (
    echo [OK]   Backend dependencies found.
    if exist "%ROOT%\backend\patches" (
        cd /d "%ROOT%\backend"
        call npx patch-package >nul 2>&1
    )
)
cd /d "%ROOT%"

:: ---- Step 4b: First-boot DB auto-setup (uses pure Node.js + mysql2) ----
echo [4b/7] Auto-configuring database...
cd /d "%ROOT%\backend"
call node scripts\first-boot-db.js
if errorlevel 1 (
    echo [WARN] DB auto-setup reported an issue [see above].
) else (
    echo [OK]   Database verified and ready.
)
cd /d "%ROOT%"

if not exist "%ROOT%\frontend\node_modules" (
    echo [INFO] Installing frontend dependencies - please wait...
    cd /d "%ROOT%\frontend"
    call npm install --legacy-peer-deps
    echo [OK]   Frontend dependencies installed.
) else (
    echo [OK]   Frontend dependencies found.
)
echo.

:: ---- Step 5: Free Ports 5001 and 3001 ----
echo [5/7] Checking and preparing network ports...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":5001 .*LISTENING"') do (
    echo [INFO] Releasing busy port 5001 PID %%P...
    taskkill /F /PID %%P >nul 2>&1
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3001 .*LISTENING"') do (
    echo [INFO] Releasing busy port 3001 PID %%P...
    taskkill /F /PID %%P >nul 2>&1
)
echo [OK]   Ports 5001 and 3001 are ready.
echo.

:: ---- Step 6: Optional services note ----
echo [6/7] Optional services...
netstat -ano | findstr ":6379 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Redis not detected on 6379 - WhatsApp queue runs in
    echo        synchronous fallback mode. Start Redis for queued sends.
) else (
    echo [OK]   Redis detected - queued WhatsApp sends enabled.
)
echo.

:: ---- Step 7: Launch Servers ----
echo [7/7] Starting Application Servers...
echo Starting BACKEND on port 5001...
start "Whatsapp_CRM Backend" /D "%ROOT%\backend" cmd /k "npm run dev"

ping -n 3 127.0.0.1 >nul

echo Starting FRONTEND on port 3001...
start "Whatsapp_CRM Frontend" /D "%ROOT%\frontend" cmd /k "npm start"

echo.
echo Waiting for backend to become healthy [up to ~90s, first boot seeds the DB]...
set "BACKEND_OK=0"
for /l %%i in (1,1,45) do (
    if "!BACKEND_OK!"=="0" (
        curl.exe -s -o NUL --max-time 3 http://127.0.0.1:5001/health >nul 2>&1
        if not errorlevel 1 set "BACKEND_OK=1"
        if "!BACKEND_OK!"=="0" ping -n 3 127.0.0.1 >nul
    )
)
if "!BACKEND_OK!"=="1" (
    echo [OK]   Backend is healthy.
) else (
    echo [WARN] Backend did not answer /health yet. It may still be seeding -
    echo        watch the "Whatsapp_CRM Backend" window, then retry login.
)
echo.
echo =====================================================
echo              WHATSAPP_CRM ONLINE
echo =====================================================
echo.
echo   Backend API    : http://localhost:5001
echo   Backend health : http://localhost:5001/health
echo.
echo   Local UI       : http://localhost:3001
if not "%LAN_IP%"=="127.0.0.1" (
    echo   LAN Network UI : http://%LAN_IP%:3001
)
echo.
echo   Login: admin@madhuratech.com  /  admin@123
echo   [works on any fresh clone - the backend auto-creates the DB, tables and admin]
echo.
echo   Login with your CRM account, then open /whatsapp.
echo   First boot: scan the QR at WhatsApp -^> Accounts if the
echo   session does not restore automatically.
echo.
echo   [Both Backend and Frontend servers are running in
echo    separate CMD windows. Keep them open while using
echo    Whatsapp_CRM. The CRM on 5000/3000 is untouched.]
echo.
echo =====================================================
echo.

pause
