@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
    py -3 server\run_server.py
    if errorlevel 1 pause
    goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
    python server\run_server.py
    if errorlevel 1 pause
    goto :eof
)

where python3 >nul 2>nul
if %errorlevel%==0 (
    python3 server\run_server.py
    if errorlevel 1 pause
    goto :eof
)

echo Python 3 was not found on this computer.
echo Install it from https://www.python.org/downloads/ and try again.
pause
