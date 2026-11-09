#!/usr/bin/env bash
# Stop Statime and give time sync back. sudo bash stop-dante.sh
[ "$(id -u)" = 0 ] || { echo "Run with sudo"; exit 1; }
U="${SUDO_USER:-arduino}"; UH="$(getent passwd "$U" | cut -d: -f6)"; F="$UH/bridge/logs/stopped-services"
pkill -x statime && echo "Statime stopped" || echo "Statime wasn't running"
if [ -f "$F" ]; then sort -u "$F" | while read -r s; do systemctl start "$s" && echo "restarted $s"; done; rm -f "$F"; fi
