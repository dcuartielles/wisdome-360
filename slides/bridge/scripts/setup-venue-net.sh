#!/usr/bin/env bash
# The UNO Q's wired network for the venue (run with sudo). One cable, one flat switch:
#   192.168.0.2/24  fixed, for the laptop (ssh, the audio stream, the status page)
#   + an automatic address for Dante: the venue's DHCP if there is one, otherwise
#     link-local 169.254.x.x (the venue, 2 Nov: their Dante devices show up as 169.254.213.x,
#     and a fixed address did not work). start-dante.sh then binds Dante to that address.
# No default gateway: internet stays on Wi-Fi. NDI does NOT come through our switch
# (the laptop's NDI backup uses its own cable, see ../VENUE-NET.md).
# Replaces db-mgmt/db-ndi/db-dante from setup-vlans.sh (the VLAN plan is not needed any more).
#   sudo bash setup-venue-net.sh [interface]
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run with sudo: sudo bash $0 $*"; exit 1; }
IF="${1:-$(ls /sys/class/net | grep -E '^(enx|eth|enp)' | grep -v '\.' | head -1)}"
[ -n "$IF" ] || { echo "No wired interface found. Pass its name as an argument."; exit 1; }
echo "Using interface: $IF"
for c in db-mgmt db-ndi db-dante db-venue; do nmcli con delete "$c" >/dev/null 2>&1 || true; done
OTHER=$(nmcli -t -f NAME,DEVICE con show --active | awk -F: -v d="$IF" '$2==d && $1!~/^db-/ {print $1}')
[ -z "$OTHER" ] || { echo "Taking down other connections on $IF: $OTHER"; while IFS= read -r c; do nmcli con down "$c" || true; nmcli con modify "$c" connection.autoconnect no || true; done <<< "$OTHER"; }
nmcli con add type ethernet ifname "$IF" con-name db-venue \
  ipv4.method auto ipv4.addresses 192.168.0.2/24 ipv4.never-default yes \
  ipv4.ignore-auto-dns yes ipv4.dhcp-timeout 10 ipv4.may-fail yes ipv6.method disabled
# link-local when DHCP gives nothing (NetworkManager 1.40+). Older NM: fall back to avahi-autoipd.
if nmcli con modify db-venue ipv4.link-local fallback 2>/dev/null; then
  echo "link-local fallback: NetworkManager"
else
  echo "This NetworkManager has no ipv4.link-local; using avahi-autoipd for 169.254.x.x"
  command -v avahi-autoipd >/dev/null || apt-get install -y avahi-autoipd
  avahi-autoipd --daemonize --wait "$IF" || true
fi
# Energy-Efficient Ethernet off whenever the link comes up (keeps the Dante clock steady)
cat > /etc/NetworkManager/dispatcher.d/90-dome-bridge-eee-off <<DISP
#!/bin/sh
[ "\$1" = "$IF" ] && [ "\$2" = "up" ] && ethtool --set-eee "$IF" eee off 2>/dev/null
exit 0
DISP
chmod 755 /etc/NetworkManager/dispatcher.d/90-dome-bridge-eee-off
nmcli con up db-venue || true
echo "Waiting for the automatic address (DHCP ~10 s, then link-local) …"
for i in $(seq 1 30); do ip -4 -o addr show dev "$IF" | grep -qv ' 192\.168\.0\.' && break; sleep 1; done
ethtool --set-eee "$IF" eee off 2>/dev/null || echo "Note: EEE could not be changed on $IF"
ip -4 -o addr show dev "$IF" | awk '{print "  " $4}'
ip -4 -o addr show dev "$IF" | grep -qv ' 192\.168\.0\.' \
  && echo "OK: a Dante address is there. Next: sudo bash ~/bridge/dante/start-dante.sh" \
  || echo "Only 192.168.0.2 so far: is the venue's Dante network plugged into our switch?"
