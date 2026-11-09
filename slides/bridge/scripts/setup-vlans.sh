#!/usr/bin/env bash
# NOTE (2 Nov): for the venue use setup-venue-net.sh instead (flat switch, NDI on its own cable).
# Creates the bridge's wired connections with NetworkManager (run with sudo).
#   untagged  -> management VLAN 1  : 192.168.0.2/24 (switch at 192.168.0.1)
#   VLAN 10   -> NDI                : 10.10.10.2/24  (home bench; change for the venue)
#   VLAN 20   -> Dante              : link-local 169.254.x.x
# No default gateway on any of them: internet stays on Wi-Fi.
set -euo pipefail
IF="${1:-$(ls /sys/class/net | grep -E '^(enx|eth|enp)' | head -1)}"
[ -n "$IF" ] || { echo "No wired interface found. Pass its name as an argument."; exit 1; }
echo "Using interface: $IF"
modprobe 8021q
echo 8021q > /etc/modules-load.d/8021q.conf
for c in db-mgmt db-ndi db-dante; do nmcli con delete "$c" >/dev/null 2>&1 || true; done
nmcli con add type ethernet ifname "$IF" con-name db-mgmt \
  ipv4.method manual ipv4.addresses 192.168.0.2/24 ipv4.never-default yes ipv6.method disabled
nmcli con add type vlan dev "$IF" id 10 con-name db-ndi \
  ipv4.method manual ipv4.addresses 10.10.10.2/24 ipv4.never-default yes ipv6.method disabled
nmcli con add type vlan dev "$IF" id 20 con-name db-dante \
  ipv4.method link-local ipv4.never-default yes ipv6.method disabled
# Energy-Efficient Ethernet off whenever the link comes up (keeps the Dante clock steady)
cat > /etc/NetworkManager/dispatcher.d/90-dome-bridge-eee-off <<DISP
#!/bin/sh
[ "\$1" = "$IF" ] && [ "\$2" = "up" ] && ethtool --set-eee "$IF" eee off 2>/dev/null
exit 0
DISP
chmod 755 /etc/NetworkManager/dispatcher.d/90-dome-bridge-eee-off
nmcli con up db-mgmt; nmcli con up db-ndi; nmcli con up db-dante
ethtool --set-eee "$IF" eee off 2>/dev/null || echo "Note: EEE could not be changed on $IF (driver may not support it)"
ip -br addr
