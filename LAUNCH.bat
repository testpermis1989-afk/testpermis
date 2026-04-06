@echo off
title Permis Maroc
set "EXE_PATH=%~dp0dist-electron\PermisMaroc.exe"

if exist "%EXE_PATH%" (
    start "" "%EXE_PATH%"
) else (
    echo ERROR: PermisMaroc.exe not found!
    echo Please run BUILD.bat first.
    pause
)
