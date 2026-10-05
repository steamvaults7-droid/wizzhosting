@echo off
setlocal
cd /d "%~dp0"
title WizzHosting Node Agent
color 0B

echo.
echo  ============================================
echo       WizzHosting Node Agent Launcher
echo  ============================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js is not installed!
  echo.
  echo  Please install Node.js from: https://nodejs.org
  echo  Choose the "LTS" version. After installing, run this file again.
  echo.
  pause
  exit /b 1
)

echo  [OK] Node.js found: 
node -v
echo.

REM Check if .env exists, create from example if not
if not exist ".env" (
  if exist ".env.example" (
    copy /Y .env.example .env >nul
    echo  [OK] Created .env from .env.example
  ) else (
    echo  [ERROR] No .env file found and no .env.example to copy from.
    echo  The .env file should contain SUPABASE_URL and SUPABASE_ANON_KEY.
    echo.
    pause
    exit /b 1
  )
) else (
  echo  [OK] .env file exists
)
echo.

echo  ============================================
echo   Starting WizzHosting Node Agent...
echo   Keep this window open while using servers.
echo   Close it to stop the agent.
echo   No additional installation is required.
echo  ============================================
echo.

echo  The agent console will stay open so any error remains visible.
echo.
cmd /k node index.js
