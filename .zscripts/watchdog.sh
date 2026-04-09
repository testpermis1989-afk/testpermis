#!/bin/bash
PROJECT_DIR="/home/z/my-project"
LOG_FILE="$PROJECT_DIR/dev.log"

cd "$PROJECT_DIR"

# Loop forever, restart on crash
while true; do
    rm -rf "$PROJECT_DIR/.next"
    echo "[$(date '+%H:%M:%S')] Starting Next.js..." >> "$LOG_FILE"
    bun next dev -p 3000 >> "$LOG_FILE" 2>&1
    echo "[$(date '+%H:%M:%S')] Server died, restarting in 2s..." >> "$LOG_FILE"
    sleep 2
done
