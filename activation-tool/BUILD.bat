@echo off
chcp 65001 >nul 2>&1
title Permis Maroc - Activation Tool

echo.
echo ============================================
echo   PERMIS MAROC - ACTIVATION TOOL
echo ============================================
echo.

echo [1/2] npm install...
call npm install --no-audit --no-fund
if %errorlevel% neq 0 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)
echo OK
echo.

echo [2/2] electron-builder (NSIS installer)...
call npx electron-builder --win nsis --x64
if %errorlevel% neq 0 (
    echo ERROR: electron-builder failed!
    pause
    exit /b 1
)
echo OK
echo.

echo ============================================
echo   BUILD COMPLETE!
echo ============================================
echo.
echo SETUP: %~dp0dist\PermisMaroc-Activation-Setup.exe
echo.
echo Give PermisMaroc-Activation-Setup.exe to clients.
echo.

pause
