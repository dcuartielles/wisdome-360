#!/usr/bin/env bash
# Read-only diagnostics for the UNO Q bridge bench (B0). Safe to run any time.
set -u
hr(){ printf '\n== %s ==\n' "$1"; }
hr "System";      uname -a; cat /etc/os-release 2>/dev/null | head -3; uptime
hr "Power/thermal"; for z in /sys/class/thermal/thermal_zone*/temp; do [ -r "$z" ] && echo "$z: $(( $(cat "$z")/1000 )) C"; done
dmesg 2>/dev/null | grep -iE 'under-?volt|over-?current|brown' | tail -5 || true
hr "USB devices"; lsusb 2>/dev/null || echo "lsusb missing: sudo apt install usbutils"
hr "Network interfaces"; ip -br link; ip -br addr
IFACES=$(ls /sys/class/net | grep -E '^(enx|eth|enp|usb)' || true)
for i in $IFACES; do
  hr "Ethernet $i"
  ethtool -i "$i" 2>/dev/null | grep -E 'driver|version|bus-info'
  ethtool "$i" 2>/dev/null | grep -E 'Speed|Duplex|Link detected'
  sudo -n ethtool --show-eee "$i" 2>/dev/null | head -4 || echo "(run with sudo to see EEE)"
done
hr "802.1Q module"
if sudo -n modprobe 8021q 2>/dev/null || lsmod | grep -q 8021q; then lsmod | grep 8021q; else
  echo "8021q not loaded (run with sudo, or module missing)"; ls /lib/modules/$(uname -r)/kernel/net/8021q 2>/dev/null; fi
hr "NetworkManager"; nmcli -t -f NAME,TYPE,DEVICE con show --active 2>/dev/null
hr "Input devices (touch)"; grep -E '^N: Name' /proc/bus/input/devices 2>/dev/null
hr "Displays"; ls /sys/class/drm 2>/dev/null
