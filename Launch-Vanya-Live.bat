@echo off
title Vanya Downloader (Live)
cd /d "%~dp0"
echo ===================================================
echo   Starting Vanya Downloader (Latest Code)
echo ===================================================
echo Checking for updates and compiling latest changes...
call cmd /c npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed. Please check errors above.
    pause
    exit /b %ERRORLEVEL%
)
echo Launching Application...
call cmd /c npx electron .
