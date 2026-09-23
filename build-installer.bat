@echo off
setlocal
cd /d "%~dp0electron"

rem Editors that are themselves Electron apps export this; it makes electron.exe
rem behave as plain Node and the build fails in confusing ways.
set "ELECTRON_RUN_AS_NODE="

where npm >nul 2>nul
if errorlevel 1 (
    echo Building the installer needs Node.js ^(for npm and electron-builder^).
    echo.
    echo   Install it with:  winget install OpenJS.NodeJS.LTS
    echo   then run this file again.
    echo.
    echo You do not need Node.js just to RUN the app - use run-desktop.bat with
    echo the portable runtime from electron\get-electron.ps1 instead.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing build dependencies...
    call npm install || goto :failed
)

echo Building the Windows installer...
call npm run dist || goto :failed

echo.
echo Done. The installer is in the dist\ folder.
pause
exit /b 0

:failed
echo.
echo Build failed - see the messages above.
pause
exit /b 1
