@echo off
setlocal
cd /d "%~dp0"

echo [Easy Runner] Detected Node.js project
echo [Easy Runner] Package manager: npm
echo [Easy Runner] Run script: dev

where npm >nul 2>nul
if errorlevel 1 (
  echo [Easy Runner] 'npm' command not found. Install it first.
  goto :finish
)

if not exist "node_modules" (
  echo [Easy Runner] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [Easy Runner] Dependency installation failed.
    goto :finish
  )
)

echo [Easy Runner] Starting project...
call npm run dev
set "RUN_EXIT=%ERRORLEVEL%"

if not "%RUN_EXIT%"=="0" (
  echo [Easy Runner] Run command exited with code %RUN_EXIT%.
) else (
  echo [Easy Runner] Run command finished.
)

:finish
echo.
echo Press any key to close this window.
pause >nul
endlocal
