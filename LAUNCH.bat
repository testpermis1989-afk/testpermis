@echo off
chcp 65001 >nul 2>&1
title Permis Maroc
color 0A

:: Find the exe
set "EXE_PATH=%~dp0dist-electron\PermisMaroc.exe"

if exist "%EXE_PATH%" (
    start "" "%EXE_PATH%"
) else (
    :: Maybe running from desktop shortcut location, try parent
    set "EXE_PATH=%~dp0..\dist-electron\PermisMaroc.exe"
    if exist "%EXE_PATH%" (
        start "" "%EXE_PATH%"
    ) else (
        echo  ❌ Fichier PermisMaroc.exe non trouvé!
        echo  📌 Veuillez relancer INSTALLER.bat depuis le dossier du projet.
        pause
    )
)
