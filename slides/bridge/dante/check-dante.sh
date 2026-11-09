#!/usr/bin/env bash
# Is the Dante side healthy? Read-only. bash check-dante.sh [interface]
U="${SUDO_USER:-$USER}"; UH="$(getent passwd "$U" | cut -d: -f6)"; LOG="$UH/bridge/logs/statime.log"
IF="${1:-$(sed -n 's/^interface = "\(.*\)"/\1/p' "$UH/bridge/logs/statime.toml" 2>/dev/null)}"
hr(){ printf '\n== %s ==\n' "$1"; }
hr "Statime";   pgrep -a statime || echo "NOT RUNNING — sudo bash start-dante.sh"
hr "Clock socket"; ls -l /tmp/ptp-usrvclock 2>/dev/null || echo "missing /tmp/ptp-usrvclock"
hr "Statime log (last 15 lines)"; tail -15 "$LOG" 2>/dev/null || echo "no log at $LOG"
hr "Clock state in the log"; grep -iE "master|slave|leader|follower|state|offset" "$LOG" 2>/dev/null | tail -5 || true
hr "Interface $IF"; ip -br addr show dev "$IF" 2>/dev/null; ip maddr show dev "$IF" 2>/dev/null | grep -E "224\.0\.1\.129|224\.0\.0\.251" || echo "(not joined to PTP 224.0.1.129 / mDNS 224.0.0.251 yet)"
hr "UDP ports (PTP 319/320, Dante 4455/8700/8800/4400, mDNS 5353)"; ss -lunp 2>/dev/null | grep -E ':(319|320|4455|8700|8800|4400|5353)\b' || echo "none listening (Inferno only listens while 'dome' is open)"
hr "ALSA device"; grep -q "pcm.dome" /etc/asound.conf && echo "'dome' defined in /etc/asound.conf" || echo "'dome' not defined — run start-dante.sh"
aplay -L 2>/dev/null | grep -A1 "^dome" || true
hr "Firewall"; (command -v nft >/dev/null && sudo -n nft list ruleset 2>/dev/null | grep -c "drop" | sed 's/^/drop rules: /') || echo "nft not installed (no firewall)"
hr "Time sync services"; for s in systemd-timesyncd chronyd ntpd; do systemctl is-active "$s" 2>/dev/null | sed "s/^/$s: /"; done
