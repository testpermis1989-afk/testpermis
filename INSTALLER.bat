@echo off
chcp 65001 >nul 2>&1
title Permis Maroc - Installation Automatique
color 0A
mode con: cols=70 lines=35

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                                                              ║
echo  ║        ⚡ PERMIS MAROC - INSTALLATION AUTOMATIQUE ⚡          ║
echo  ║        اختبار رخصة القيادة - التثبيت التلقائي               ║
echo  ║                                                              ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.

:: ============================================================
:: STEP 0: Check if running as admin (optional but recommended)
:: ============================================================
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  [INFO] Execution sans admin - OK
    echo.
)

:: ============================================================
:: STEP 1: Check Node.js
:: ============================================================
echo  [1/5] Vérification de Node.js...
echo  ─────────────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ❌ Node.js n'est pas installé!
    echo  📥 Téléchargement de Node.js en cours...
    echo.
    
    :: Download Node.js using PowerShell
    powershell -Command "& {Invoke-WebRequest -Uri 'https://nodejs.org/dist/v24.13.1/node-v24.13.1-x64.msi' -OutFile '%TEMP%\node-installer.msi'}"
    
    if exist "%TEMP%\node-installer.msi" (
        echo  ✅ Téléchargement terminé!
        echo  📦 Installation de Node.js...
        msiexec /i "%TEMP%\node-installer.msi" /quiet /norestart
        
        :: Wait for installation
        timeout /t 30 /nobreak >nul
        
        :: Refresh PATH
        set "PATH=%PATH%;C:\Program Files\nodejs"
        
        where node >nul 2>&1
        if %errorlevel% neq 0 (
            echo.
            echo  ❌ L'installation de Node.js a échoué.
            echo  📌 Veuillez installer Node.js manuellement depuis:
            echo     https://nodejs.org/
            echo.
            pause
            exit /b 1
        )
        echo  ✅ Node.js installé avec succès!
    ) else (
        echo  ❌ Impossible de télécharger Node.js.
        echo  📌 Veuillez installer Node.js manuellement depuis:
        echo     https://nodejs.org/
        echo.
        pause
        exit /b 1
    )
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
    echo  ✅ Node.js trouvé: %NODE_VER%
)
echo.

:: ============================================================
:: STEP 2: Install npm dependencies
:: ============================================================
echo  [2/5] Installation des dépendances...
echo  ─────────────────────────────────────────────────────
echo  ⏳ npm install en cours (cela peut prendre 2-5 minutes)...
echo.
call npm install --no-audit --no-fund 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  ❌ Erreur lors de l'installation des dépendances!
    echo  📌 Réessayez: supprimez le dossier "node_modules" et relancez.
    echo.
    pause
    exit /b 1
)
echo  ✅ Dépendances installées!
echo.

:: ============================================================
:: STEP 3: Build the application
:: ============================================================
echo  [3/5] Compilation de l'application...
echo  ─────────────────────────────────────────────────────
echo  ⏳ next build en cours (cela peut prendre 2-3 minutes)...
echo.
set NEXT_PUBLIC_STORAGE_MODE=local
call npx next build 2>nul
if %errorlevel% neq 0 (
    echo  ❌ Erreur lors de la compilation!
    echo.
    pause
    exit /b 1
)
echo.
echo  ✅ Compilation terminée!
echo.

:: ============================================================
:: STEP 4: Build Electron .exe
:: ============================================================
echo  [4/5] Création du fichier .exe...
echo  ─────────────────────────────────────────────────────
echo  ⏳ electron-builder en cours (cela peut prendre 3-5 minutes)...
echo.
call npx electron-builder --win portable --x64 2>nul
if %errorlevel% neq 0 (
    echo  ❌ Erreur lors de la création du .exe!
    echo.
    pause
    exit /b 1
)
echo.
echo  ✅ Fichier .exe créé!
echo.

:: ============================================================
:: STEP 5: Create desktop shortcut
:: ============================================================
echo  [5/5] Création du raccourci bureau...
echo  ─────────────────────────────────────────────────────

set "EXE_PATH=%~dp0dist-electron\PermisMaroc.exe"
set "SHORTCUT_NAME=Permis Maroc.lnk"
set "DESKTOP=%USERPROFILE%\Desktop"

if exist "%EXE_PATH%" (
    :: Create desktop shortcut using PowerShell
    powershell -Command "& {$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP%\%SHORTCUT_NAME%'); $s.TargetPath = '%EXE_PATH%'; $s.WorkingDirectory = '%~dp0dist-electron'; $s.Description = 'Permis Maroc - Test du Permis de Conduire'; $s.IconLocation = '%EXE_PATH%,0'; $s.Save()}"
    
    if exist "%DESKTOP%\%SHORTCUT_NAME%" (
        echo  ✅ Raccourci bureau créé: "%DESKTOP%\%SHORTCUT_NAME%"
    ) else (
        echo  ⚠️  Impossible de créer le raccourci bureau automatiquement
        echo  📌 Le fichier .exe se trouve ici: %EXE_PATH%
    )
) else (
    echo  ⚠️  Fichier .exe non trouvé à: %EXE_PATH%
    echo  📌 Vérifiez que le build a réussi.
)

:: Also create Start Menu shortcut
set "STARTMENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
if exist "%EXE_PATH%" (
    powershell -Command "& {$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%STARTMENU%\%SHORTCUT_NAME%'); $s.TargetPath = '%EXE_PATH%'; $s.WorkingDirectory = '%~dp0dist-electron'; $s.Description = 'Permis Maroc - Test du Permis de Conduire'; $s.IconLocation = '%EXE_PATH%,0'; $s.Save()}"
    echo  ✅ Raccourci menu démarrage créé!
)

echo.

:: ============================================================
:: DONE!
:: ============================================================
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                                                              ║
echo  ║        ✅ INSTALLATION TERMINÉE AVEC SUCCÈS! ✅              ║
echo  ║               تم التثبيت بنجاح                              ║
echo  ║                                                              ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.
echo  📍 Fichier .exe: %EXE_PATH%
echo  📍 Raccourci bureau: %DESKTOP%\%SHORTCUT_NAME%
echo.
echo  ─────────────────────────────────────────────────────
echo.
echo  Voulez-vous lancer l'application maintenant? (O/N)
set /p LAUNCH=
if /i "%LAUNCH%"=="O" (
    if exist "%EXE_PATH%" (
        start "" "%EXE_PATH%"
    )
)

echo.
echo  Merci d'utiliser Permis Maroc! 🚗
echo.
pause
