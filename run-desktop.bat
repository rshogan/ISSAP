@echo off
setlocal
cd /d "%~dp0"

rem Editors that are themselves Electron apps export this, which would make
rem electron.exe start as plain Node instead of launching the app.
set "ELECTRON_RUN_AS_NODE="

rem Portable runtime first (electron\get-electron.ps1), npm install second.
if exist "electron\runtime\electron.exe" (
    start "" "electron\runtime\electron.exe" "%~dp0electron"
    goto :eof
)

if exist "electron\node_modules\.bin\electron.cmd" (
    pushd electron
    start "" cmd /c "node_modules\.bin\electron.cmd ."
    popd
    goto :eof
)

echo ISSAP Cyber Conquest - desktop app
echo.
echo No Electron runtime was found. Set one up with either:
echo.
echo   1^) No Node.js required - download the prebuilt runtime:
echo        powershell -ExecutionPolicy Bypass -File electron\get-electron.ps1
echo.
echo   2^) If you have Node.js installed:
echo        cd electron ^&^& npm install
echo.
echo Then run this file again. (run.bat still opens the game in a browser.)
pause
