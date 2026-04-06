@echo off
chcp 65001 >nul 2>&1
title Permis Maroc - Build Portable .exe
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                                                              ║
echo  ║        🚀 PERMIS MAROC - BUILD PORTABLE .exe 🚀             ║
echo  ║                                                              ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.

:: ============================================================
:: STEP 1: Install cross-env if needed
:: ============================================================
echo  [1/4] Installation de cross-env...
call npm install cross-env --save-dev --no-audit --no-fund 2>nul
echo  ✅ Prêt!
echo.

:: ============================================================
:: STEP 2: Build Next.js
:: ============================================================
echo  [2/4] Compilation Next.js...
echo  ⏳ next build en cours...
echo.
set NEXT_PUBLIC_STORAGE_MODE=local
call npx next build
if %errorlevel% neq 0 (
    echo.
    echo  ❌ Erreur de compilation Next.js!
    pause
    exit /b 1
)
echo  ✅ Compilation Next.js terminée!
echo.

:: ============================================================
:: STEP 3: Copy build files
:: ============================================================
echo  [3/4] Copie des fichiers statiques...
call node scripts/copy-build.js
echo  ✅ Fichiers copiés!
echo.

:: ============================================================
:: STEP 4: Build Electron portable
:: ============================================================
echo  [4/4] Création du fichier .exe portable...
echo  ⏳ electron-builder en cours (cela peut prendre 3-5 minutes)...
echo.
call npx electron-builder --win portable --x64
if %errorlevel% neq 0 (
    echo.
    echo  ❌ Erreur lors de la création du .exe!
    pause
    exit /b 1
)

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                                                              ║
echo  ║        ✅ BUILD TERMINÉ AVEC SUCCÈS! ✅                     ║
echo  ║                                                              ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.
echo  📍 Fichier .exe: %~dp0dist-electron\PermisMaroc.exe
echo.

:: Create desktop shortcut
set "EXE_PATH=%~dp0dist-electron\PermisMaroc.exe"
set "SHORTCUT_NAME=Permis Maroc.lnk"
set "DESKTOP=%USERPROFILE%\Desktop"

if exist "%EXE_PATH%" (
    powershell -Command "& {$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP%\%SHORTCUT_NAME%'); $s.TargetPath = '%EXE_PATH%'; $s.WorkingDirectory = '%~dp0dist-electron'; $s.Description = 'Permis Maroc'; $s.IconLocation = '%EXE_PATH%,0'; $s.Save()}"
    echo  📍 Raccourci bureau créé: %DESKTOP%\%SHORTCUT_NAME%
)

echo.
pause
