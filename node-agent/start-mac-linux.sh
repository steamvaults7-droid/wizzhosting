#!/bin/bash
cd "$(dirname "$0")"
clear
echo ""
echo "  ============================================"
echo "       WizzHosting Node Agent Launcher"
echo "  ============================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "  [ERROR] Node.js is not installed!"
  echo ""
  echo "  Please install Node.js from: https://nodejs.org"
  echo "  Choose the 'LTS' version. After installing, run this file again."
  echo ""
  # On macOS, try to open the browser
  if [[ "$(uname)" == "Darwin" ]]; then
    echo "  Opening Node.js download page..."
    open "https://nodejs.org"
  fi
  echo ""
  read -p "  Press Enter to exit..."
  exit 1
fi

echo "  [OK] Node.js found: $(node -v)"
echo ""

# Check if .env exists, create from example if not
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "  [OK] Created .env from .env.example"
  else
    echo "  [ERROR] No .env file found and no .env.example to copy from."
    echo "  The .env file should contain SUPABASE_URL and SUPABASE_ANON_KEY."
    echo ""
    read -p "  Press Enter to exit..."
    exit 1
  fi
else
  echo "  [OK] .env file exists"
fi
echo ""

echo "  ============================================"
echo "   Starting WizzHosting Node Agent..."
echo "   Keep this window open while using servers."
echo "   Close it to stop the agent."
echo "   No additional installation is required."
echo "  ============================================"
echo ""

node index.js

echo ""
echo "  Node agent has stopped."
read -p "  Press Enter to exit..."
