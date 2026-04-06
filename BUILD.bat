@echo off
chcp 65001 >nul 2>&1
title Permis Maroc - Build

echo.
echo ============================================
echo   PERMIS MAROC - BUILD PORTABLE .exe
echo ============================================
echo.

echo [1/4] npm install...
call npm install --no-audit --no-fund
if %errorlevel% neq 0 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)
echo OK
echo.

echo [2/4] next build...
set NEXT_PUBLIC_STORAGE_MODE=local
call npx next build
if %errorlevel% neq 0 (
    echo ERROR: next build failed!
    pause
    exit /b 1
)
echo OK
echo.

echo [3/4] copy-build...
call node scripts/copy-build.js
echo OK
echo.

echo [4/4] electron-builder...
call npx electron-builder --win portable --x64
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
echo EXE: %~dp0dist-electron\PermisMaroc.exe
echo.

pause
