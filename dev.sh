#!/usr/bin/env bash
set -euo pipefail

# Dev runner
# Usage:
#   ./dev.sh            # interactive menu
#   ./dev.sh admin      # Admin (Next.js), pre-kill admin port (3002)
#   ./dev.sh client     # Client (Express + Vite)
#   ./dev.sh backend    # Client Backend (Express)
#   ./dev.sh frontend   # Client Frontend (Vite)
#   ./dev.sh full       # All (Client Frontend + Client Backend + Admin)

usage() {
  cat <<USAGE
Usage: ./dev.sh [mode]

Modes:
  admin     Start Admin (Next) only; pre-kill admin port (3002)
  client    Start Client (Express + Vite)
  backend   Start Client Backend (Express) only
  frontend  Start Client Frontend (Vite) only
  full      Start Client Frontend (Vite), Client Backend (Express), and Admin (Next)

No mode provided -> an interactive menu will be shown.
USAGE
}

# Pick mode interactively when no args are provided
pick_mode() {
  echo "Select mode:" >&2
  local options=(
    "Admin (Next)"
    "Client (Express + Vite)"
    "Client Backend (Express)"
    "Client Frontend (Vite)"
  )
  local PS3="Enter choice [1-4]: "
  select opt in "${options[@]}"; do
    case "$REPLY" in
      1) MODE="admin"; break ;;
      2) MODE="client"; break ;;
      3) MODE="back"; break ;;
      4) MODE="front"; break ;;
      *) echo "Please enter 1-4." >&2 ;;
    esac
  done
}

if [ $# -eq 0 ]; then
  pick_mode
else
  MODE="$1"
fi

run_full() {
  echo "Starting client-frontend (Vite), client-backend (Express), and Admin (Next)..."
  ensure_deps_frontend
  ensure_deps_backend
  ensure_deps_admin
  local admin_port
  admin_port=$(pick_admin_port)
  echo "Using admin port: $admin_port"
  npx -y concurrently -k -n "frontend,backend,admin" -c "green,blue,magenta" \
    "bash -lc 'cd apps/client/frontend && npm run dev'" \
    "bash -lc 'cd apps/client/backend && npm run dev'" \
    "bash -lc 'cd apps/admin && PORT=$admin_port npm run dev'"
}

run_admin() {
  echo "Starting admin (Next) only..."
  ensure_deps_admin
  local admin_port
  admin_port=3002
  # Ensure Admin port is free (kill any process bound to it)
  kill_port $admin_port
  echo "Using admin port: $admin_port"
  # Run admin dev server using its own internal Next.js API routes
  (cd apps/admin && PORT=$admin_port npm run dev)
}

# Start Client (Express backend + Vite frontend)
run_client() {
  echo "Starting client (Express + Vite)..."
  ensure_deps_frontend
  ensure_deps_backend
  npx -y concurrently -k -n "frontend,backend" -c "green,blue" \
    "bash -lc 'cd apps/client/frontend && npm run dev'" \
    "bash -lc 'cd apps/client/backend && npm run dev'"
}

run_frontend() {
  echo "Starting client-frontend (Vite) only..."
  ensure_deps_frontend
  (cd apps/client/frontend && npm run dev)
}

run_backend() {
  echo "Starting client-backend (Express) only..."
  ensure_deps_backend
  (cd apps/client/backend && npm run dev)
}

ensure_deps_backend() {
  if [ ! -d apps/client/backend/node_modules ]; then
    echo "Installing client-backend (Express) deps..."
    (cd apps/client/backend && npm install)
  fi
}

ensure_deps_admin() {
  echo "Ensuring Admin (Next) deps installed..."
  (cd apps/admin && npm install)
}

ensure_deps_frontend() {
  if [ ! -d apps/client/frontend/node_modules ]; then
    echo "Installing client-frontend (Vite) deps..."
    (cd apps/client/frontend && npm install)
  fi
}

# Kill any process listening on the specified TCP port (macOS compatible)
kill_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti tcp:"$port" || true)
  if [ -n "$pids" ]; then
    echo "Killing processes on port $port: $pids"
    kill -9 $pids || true
  fi
}

# Pick an available admin port (prefers 3001)
pick_admin_port() {
  for p in 3001 3002 3003 3004 3005; do
    if ! lsof -ti tcp:$p >/dev/null 2>&1; then
      echo "$p"
      return 0
    fi
  done
  # fallback
  echo "3001"
}

case "$MODE" in
  -h|--help)
    usage; exit 0 ;;
  admin)
    run_admin ;;
  client)
    run_client ;;
  frontend)
    run_frontend ;;
  backend)
    run_backend ;;
  full)
    run_full ;;
  *)
    echo "Unknown mode: '$MODE'" >&2
    usage
    exit 1 ;;
esac
