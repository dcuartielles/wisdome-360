#!/usr/bin/env bash
# Boot splash for the UNO Q's DSI screen: vaporwave until someone touches the glass.
#     sudo bash ~/bridge/screen/install-splash.sh            # install + enable (runs from next boot)
#     sudo bash ~/bridge/screen/install-splash.sh --now      # ...and start it now
#     sudo bash ~/bridge/screen/install-splash.sh --remove
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
DEMO=/home/arduino/uno_q_dsi_displays
UNIT=domebridge-splash.service

if [ "${1:-}" = --remove ]; then
  systemctl disable --now "$UNIT" 2>/dev/null || true
  rm -f "/etc/systemd/system/$UNIT" /etc/sysctl.d/90-domebridge-quiet-console.conf
  systemctl daemon-reload; echo "removed"; exit 0
fi

[ -d "$DEMO" ] || sudo -u arduino git clone -q https://github.com/dcuartielles/uno_q_dsi_displays.git "$DEMO"
command -v chvt >/dev/null || DEBIAN_FRONTEND=noninteractive apt-get install -y -qq kbd   # the demo switches consoles
# Kernel messages are drawn over whatever console is on screen; the polled touch driver logs
# an I2C error about once a second, which shows as glitches over the animation. Keep only
# emergencies on the console (dmesg still has everything).
echo 'kernel.printk = 3 4 1 3' > /etc/sysctl.d/90-domebridge-quiet-console.conf
sysctl -q -p /etc/sysctl.d/90-domebridge-quiet-console.conf
install -m 644 "$HERE/$UNIT" "/etc/systemd/system/$UNIT"
systemctl daemon-reload
systemctl enable "$UNIT"
[ "${1:-}" = --now ] && systemctl restart "$UNIT"
echo "OK: $UNIT enabled (status: systemctl status $UNIT)"
