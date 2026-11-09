#!/usr/bin/env bash
# Start the Dante side of the UNO Q bridge: Statime (clock) + the Inferno ALSA device "dome".
#   sudo bash start-dante.sh [interface]
# Interface: the one on the Dante network. Flat network (dry run): the USB Ethernet (enx…).
# With VLANs: the Dante VLAN (…20). Auto-detected if not given.
# Expects the builds from the dry-run checklist step 4:
#   ~/statime/target/release/statime
#   ~/inferno/target/release/libasound_module_pcm_inferno.so
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run with sudo: sudo bash $0 $*"; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"
U="${SUDO_USER:-arduino}"; UH="$(getent passwd "$U" | cut -d: -f6)"
STATIME="${STATIME:-$UH/statime/target/release/statime}"
PLUGIN="${PLUGIN:-$UH/inferno/target/release/libasound_module_pcm_inferno.so}"
LOGDIR="$UH/bridge/logs"; mkdir -p "$LOGDIR"; chown "$U" "$LOGDIR"

# 1. interface
IF="${1:-}"
if [ -z "$IF" ]; then
  IF=$(ls /sys/class/net | grep -E '\.20$' | head -1 || true)              # Dante VLAN, if set up
  [ -n "$IF" ] || IF=$(ls /sys/class/net | grep -E '^(enx|eth|enp)' | grep -v '\.' | head -1 || true)
fi
[ -n "$IF" ] && [ -e "/sys/class/net/$IF" ] || { echo "No interface found; pass it: sudo bash $0 <iface>"; ip -br link; exit 1; }
ADDRS=$(ip -4 -o addr show dev "$IF" | awk '{print $4}' | cut -d/ -f1 | tr '\n' ' ')
echo "Dante interface: $IF  addresses: ${ADDRS:-(no IPv4 address!)}"
[ -n "$ADDRS" ] || { echo "The interface needs an IPv4 address first (setup-venue-net.sh, or dry-run step 3)."; exit 1; }
# Which address Dante uses. Venue (2 Nov): Dante devices get their address automatically
# (DHCP, or link-local 169.254.x.x); a fixed address did not work. Our own 192.168.0.2 stays on
# the same cable for the laptop. So: DANTE_IP if given, else the first address that is NOT
# 192.168.0.x (DHCP or 169.254), else the only one there is (home bench, flat network).
DANTE_IP="${DANTE_IP:-}"
if [ -z "$DANTE_IP" ]; then
  for a in $ADDRS; do case "$a" in 192.168.0.*) ;; *) DANTE_IP="$a"; break ;; esac; done
  [ -n "$DANTE_IP" ] || DANTE_IP="${ADDRS%% *}"
fi
echo "Dante address: $DANTE_IP   (override: sudo DANTE_IP=… bash $0)"
# Sample rate of the Dante device. Must match the venue's Dante network (Dante Controller shows it;
# 48 kHz is the most common, 96 kHz and 44.1 kHz exist). The receiver resamples the laptop's
# stream to it: start it with the same rate (domebridge_rx.py --rate $RATE).
SAVED_RATE=$(cat "$LOGDIR/rate" 2>/dev/null || echo 48000)   # last rate set from the status page
RATE="${RATE:-$SAVED_RATE}"
case "$RATE" in 44100|48000|88200|96000) ;; *) echo "RATE must be 44100, 48000, 88200 or 96000"; exit 1 ;; esac
echo "Sample rate: $RATE Hz   (override: sudo RATE=96000 bash $0; then domebridge_rx.py --rate $RATE)"
echo "$RATE" > "$LOGDIR/rate"; chown "$U" "$LOGDIR/rate"

# 2. builds present?
[ -x "$STATIME" ] || { echo "Missing $STATIME — build Statime first (checklist step 4)."; exit 1; }
[ -f "$PLUGIN" ]  || { echo "Missing $PLUGIN — build Inferno first (checklist step 4)."; exit 1; }

# 3. Inferno's ALSA plugin where libasound looks for plugins
ALSALIB=$(find /usr/lib* -type d -name alsa-lib 2>/dev/null | grep -m1 "$(dpkg-architecture -qDEB_HOST_MULTIARCH 2>/dev/null || echo aarch64-linux-gnu)" || find /usr/lib* -type d -name alsa-lib | head -1)
if [ -z "$ALSALIB" ]; then   # no plugin folder yet: create the one libasound searches
  MA=$(gcc -print-multiarch 2>/dev/null || echo aarch64-linux-gnu); ALSALIB="/usr/lib/$MA/alsa-lib"; mkdir -p "$ALSALIB"
fi
install -m 644 "$PLUGIN" "$ALSALIB/"
echo "ALSA plugin → $ALSALIB/$(basename "$PLUGIN")"

# 4. ALSA device "dome", system-wide (so it works under sudo too). Replaces our own block only.
touch /etc/asound.conf
sed -i '/# >>> dome-bridge/,/# <<< dome-bridge <<</d' /etc/asound.conf
sed -e "s/@BIND@/$DANTE_IP/" -e "s/@RATE@/$RATE/" "$HERE/asound-domebridge.conf" >> /etc/asound.conf
echo "ALSA device 'dome' → /etc/asound.conf (BIND_IP $DANTE_IP)"

# 5. NTP off while Dante runs (Inferno's README: avoids clock collisions). Undo: stop-dante.sh
for s in systemd-timesyncd chronyd chrony ntpd ntp; do systemctl is-active --quiet "$s" 2>/dev/null && { systemctl stop "$s"; echo "stopped $s (time sync)"; echo "$s" >> "$LOGDIR/stopped-services"; }; done
true

# 6. Statime
pkill -x statime 2>/dev/null && sleep 1 || true
CONF="$LOGDIR/statime.toml"
sed "s/@IFACE@/$IF/" "$HERE/statime-domebridge.toml" > "$CONF"
nohup "$STATIME" -c "$CONF" > "$LOGDIR/statime.log" 2>&1 &
echo "Statime started (pid $!), log: $LOGDIR/statime.log"
for i in $(seq 1 20); do [ -S /tmp/ptp-usrvclock ] && break; sleep 0.5; done
if [ -S /tmp/ptp-usrvclock ]; then
  chmod 666 /tmp/ptp-usrvclock    # let a non-root Inferno reach the clock, too
  echo "Clock socket: /tmp/ptp-usrvclock"
else
  echo "WARNING: /tmp/ptp-usrvclock did not appear. Look at: tail -50 $LOGDIR/statime.log"
fi
cat <<MSG

Next:
  • Wait ~10–20 s, then: bash $HERE/check-dante.sh   (Statime should report a clock master: Dante Via)
  • Test tone straight into Inferno (Ctrl+C to stop):
      sudo speaker-test -D dome -c 6 -F S32_LE -r $RATE -t sine -f 440
  • Or the bridge itself (tone/ident buttons on http://<uno-q>:9301/):
      sudo python3 $UH/bridge/rx/domebridge_rx.py --device dome --rate $RATE --tone
  • In Dante Controller (laptop): DOME-BRIDGE appears while a program has 'dome' open.
    Subscribe Dante Via's inputs to DOME-BRIDGE channels 01–02 (L, R).
MSG
