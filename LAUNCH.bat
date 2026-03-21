@echo off
setlocal

cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 goto :error
)

set "LOGFILE=%TEMP%\wumpus-world-dev.log"
if exist "%LOGFILE%" del "%LOGFILE%"

echo Starting Wumpus World Atlas...
start "Wumpus World Dev Server" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location '%~dp0'; npm.cmd run dev 2>&1 | Tee-Object -FilePath '%LOGFILE%'"

echo Waiting for the localhost URL...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$log = '%LOGFILE%'; $url = $null; for ($i = 0; $i -lt 120 -and -not $url; $i++) { Start-Sleep -Seconds 1; if (Test-Path $log) { $content = Get-Content $log -Raw; $matches = [regex]::Matches($content, 'http://localhost:\d+'); if ($matches.Count -gt 0) { $url = $matches[$matches.Count - 1].Value } } }; if (-not $url) { $url = 'http://localhost:3000' }; Start-Process $url; Write-Host ('Opened ' + $url)"

echo Launcher finished.
exit /b 0

:error
echo Failed to install dependencies or start the dev server.
pause
exit /b 1
