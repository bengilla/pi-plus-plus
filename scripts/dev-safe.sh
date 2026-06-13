#!/bin/bash
# Safe dev server starter with health check + auto-recovery
# Usage: ./scripts/dev-safe.sh

set -euo pipefail
PORT="${1:-31508}"
MAX_WAIT=60
CHECK_INTERVAL=2
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CACHE_DIR="$PROJECT_DIR/.next"
LOG_FILE="/tmp/pi-plus-plus-dev.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${2:-}$(date '+%H:%M:%S') $1${NC}"; }

# Kill existing process on port
kill_port() {
    local pid=$(lsof -ti :"$PORT" 2>/dev/null || true)
    if [ -n "$pid" ]; then
        log "Killing existing process on port $PORT (PID $pid)..." "$YELLOW"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

# Clear Turbopack cache
clear_cache() {
    if [ -d "$CACHE_DIR" ]; then
        log "Clearing .next cache..." "$YELLOW"
        rm -rf "$CACHE_DIR"
    fi
}

# Wait for server to become healthy
wait_healthy() {
    local elapsed=0
    while [ $elapsed -lt $MAX_WAIT ]; do
        if curl -s --noproxy '*' --max-time 3 -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" 2>/dev/null | grep -q "200"; then
            return 0
        fi
        sleep $CHECK_INTERVAL
        elapsed=$((elapsed + CHECK_INTERVAL))
        echo -n "."
    done
    echo ""
    return 1
}

start_server() {
    log "Starting dev server on port $PORT..." "$GREEN"
    cd "$PROJECT_DIR"
    nohup npm run dev > "$LOG_FILE" 2>&1 &
    local pid=$!
    log "PID: $pid, log: $LOG_FILE"

    echo -n "Waiting for compilation"
    if wait_healthy; then
        echo ""
        log "✓ Server ready: http://localhost:$PORT" "$GREEN"
        return 0
    else
        echo ""
        return 1
    fi
}

# === Main ===
kill_port

# First attempt: normal start
if start_server; then
    exit 0
fi

log "✗ Server didn't respond in ${MAX_WAIT}s — clearing cache and retrying..." "$YELLOW"

# Kill the hung process
kill_port
clear_cache

# Second attempt: clean start
if start_server; then
    log "✓ Recovered after cache clear" "$GREEN"
    exit 0
fi

log "✗ Server still not responding. Check $LOG_FILE for errors." "$RED"
log "Last 20 lines of log:" "$RED"
tail -20 "$LOG_FILE"
exit 1
