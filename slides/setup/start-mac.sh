#!/bin/bash
# Dome slides: start on macOS.   bash setup/start-mac.sh
cd "$(dirname "$0")/.." || exit 1
node server/server.mjs &
sleep 1
CHROME="/Applications/Google Chrome.app"
if [ -d "$CHROME" ]; then
  open -na "$CHROME" --args --new-window --autoplay-policy=no-user-gesture-required http://localhost:8360/audio/
  open -na "$CHROME" --args --new-window http://localhost:8360/presenter/
else open http://localhost:8360/presenter/; fi
echo "OBS: add a Browser Source  http://localhost:8360/video/  width 2048, height 2048, FPS 30 (custom)."
wait
