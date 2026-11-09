#!/bin/bash
# Dome slides on macOS: double-click (first time: right-click > Open). Close the Terminal window to stop.
cd "$(dirname "$0")/.." || exit 1
NODE="$(command -v node || true)"
for n in /opt/homebrew/bin/node /usr/local/bin/node; do [ -z "$NODE" ] && [ -x "$n" ] && NODE="$n"; done
[ -z "$NODE" ] && { echo "Node.js not found: install it from nodejs.org"; read -r; exit 1; }
exec "$NODE" server/server.mjs --launch
