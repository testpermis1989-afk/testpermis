@echo off
chcp 65001 >nul 2>&1
title Permis Maroc - Mise a jour depuis GitHub
color 0A

echo.
echo  ============================================================
echo     DOWNLOADING LATEST CODE FROM GITHUB...
echo  ============================================================
echo.

:: Download latest code as ZIP from GitHub
echo  Downloading source code...
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/testpermis1989-afk/testpermis/archive/refs/heads/main.zip' -OutFile '%TEMP%\testpermis-latest.zip'}"

if not exist "%TEMP%\testpermis-latest.zip" (
    echo  ERROR: Download failed!
    pause
    exit /b 1
)

echo  Download complete!
echo.

:: Extract ZIP
echo  Extracting...
powershell -Command "& {Expand-Archive -Path '%TEMP%\testpermis-latest.zip' -DestinationPath '%TEMP%\testpermis-update' -Force}"

if not exist "%TEMP%\testpermis-update\testpermis-main" (
    echo  ERROR: Extraction failed!
    pause
    exit /b 1
)

echo  Extraction complete!
echo.

:: Copy updated files to current directory (overwrite)
echo  Updating source files...

set "UPDATE_DIR=%TEMP%\testpermis-update\testpermis-main"

:: Copy key files that need updating
xcopy /Y /Q "%UPDATE_DIR%\src\app\api\activation\activate\route.ts" "src\app\api\activation\activate\" 2>nul
xcopy /Y /Q "%UPDATE_DIR%\src\app\api\activation\machine-code\route.ts" "src\app\api\activation\machine-code\" 2>nul
xcopy /Y /Q "%UPDATE_DIR%\src\app\api\activation\status\route.ts" "src\app\api\activation\status\" 2>nul
xcopy /Y /Q "%UPDATE_DIR%\src\app\api\activation\licenses\route.ts" "src\app\api\activation\licenses\" 2>nul
xcopy /Y /Q "%UPDATE_DIR%\src\app\api\activation\generate\route.ts" "src\app\api\activation\generate\" 2>nul
xcopy /Y /Q "%UPDATE_DIR%\src\app\api\license\activate\route.ts" "src\app\api\license\activate\" 2>nul
xcopy /Y /Q "%UPDATE_DIR%\src\app\api\license\route.ts" "src\app\api\license\" 2>nul
xcopy /Y /Q "%UPDATE_DIR%\src\lib\machine-id.ts" "src\lib\" 2>nul
xcopy /Y /Q "%UPDATE_DIR%\src\lib\activation.ts" "src\lib\" 2>nul
xcopy /Y /Q "%UPDATE_DIR%\src\lib\license-crypto.ts" "src\lib\" 2>nul
xcopy /Y /Q "%UPDATE_DIR%\src\lib\local-db.ts" "src\lib\" 2>nul
xcopy /Y /Q "%UPDATE_DIR%\src\lib\db.ts" "src\lib\" 2>nul
xcopy /Y /Q "%UPDATE_DIR%\package.json" "." 2>nul
xcopy /Y /Q "%UPDATE_DIR%\electron\main.js" "electron\" 2>nul
xcopy /Y /Q "%UPDATE_DIR%\electron\preload.js" "electron\" 2>nul
xcopy /Y /Q "%UPDATE_DIR%\electron\loading.html" "electron\" 2>nul
xcopy /Y /Q "%UPDATE_DIR%\scripts\copy-build.js" "scripts\" 2>nul
xcopy /Y /Q "%UPDATE_DIR%\BUILD_PORTABLE.bat" "." 2>nul
xcopy /Y /Q "%UPDATE_DIR%\INSTALLER.bat" "." 2>nul

echo  Files updated!
echo.

:: Clean up temp files
echo  Cleaning up...
del /Q "%TEMP%\testpermis-latest.zip" 2>nul
rmdir /S /Q "%TEMP%\testpermis-update" 2>nul

echo.
echo  ============================================================
echo     UPDATE COMPLETE!
echo  ============================================================
echo.
echo  Now run: BUILD_PORTABLE.bat
echo.
pause
