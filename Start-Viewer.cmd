@echo off
cd /d "%~dp0" || exit /b 1
if not exist "%~dp0node_modules\electron\dist\electron.exe" (
  echo Dependencies are missing. Run npm ci in this folder first.
  pause
  exit /b 1
)
start "SWTOR Model Viewer" "%~dp0node_modules\electron\dist\electron.exe" . %*
