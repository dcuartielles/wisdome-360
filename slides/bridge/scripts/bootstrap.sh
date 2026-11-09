#!/usr/bin/env bash
# One-shot preparation of the UNO Q for the dome bridge (dry-run steps 3–4 + 8a prerequisites).
# Run on the UNO Q as user arduino (it asks for sudo once):
#     bash ~/bridge/scripts/bootstrap.sh
# It re-launches itself in the background, so a dropped SSH connection doesn't stop it.
# Follow it with:   tail -f ~/bridge/logs/bootstrap.log
# Re-running is safe: finished parts are skipped.
set -uo pipefail
LOGDIR="$HOME/bridge/logs"; mkdir -p "$LOGDIR"; LOG="$LOGDIR/bootstrap.log"
if [ "${BOOTSTRAP_CHILD:-}" != 1 ]; then
  sudo true || { echo "needs sudo"; exit 1; }   # not 'sudo -v': it wants a password unless every sudoers entry is NOPASSWD
  ( while true; do sudo -n true; sleep 50; kill -0 "$$" 2>/dev/null || exit; done ) 2>/dev/null &   # keep sudo alive
  echo "Starting in the background. Log: $LOG"
  echo "Follow with:  tail -f $LOG     (Ctrl+C stops following, not the job)"
  BOOTSTRAP_CHILD=1 nohup bash "$0" "$@" > "$LOG" 2>&1 &
  sleep 2; tail -n 5 "$LOG"; exit 0
fi

step(){ printf '\n=== %s  [%s] ===\n' "$1" "$(date +%H:%M:%S)"; }
ok(){ echo "OK: $*"; }; bad(){ echo "PROBLEM: $*"; }
t0=$(date +%s)

step "1/7 System"
uname -a; . /etc/os-release && echo "$PRETTY_NAME"; free -h | head -2; df -h "$HOME" | tail -1; nproc

step "2/7 Packages"
# Arduino ships libasound2t64 from trixie-backports; Debian's own libasound2-dev pins its own
# version, so ask for the -dev package at exactly the installed library's version.
ALSAVER=$(dpkg-query -W -f='${Version}' libasound2t64 2>/dev/null)
sudo -n apt-get update -qq && \
sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  build-essential pkg-config "libasound2-dev${ALSAVER:+=$ALSAVER}" clang git curl ethtool usbutils \
  alsa-utils python3-numpy kbd > /dev/null && ok "packages installed" || bad "apt failed (see above)"

# DSI panel enabled → USB-C stuck in device mode → no hub, no Ethernet (see usb-host-mode.service)
if [ "$(sudo -n cat /sys/kernel/debug/usb/4e00000.usb/mode 2>/dev/null)" = device ] || \
   systemctl is-enabled usb-host-mode >/dev/null 2>&1; then
  sudo -n install -m 644 "$HOME/bridge/scripts/usb-host-mode.service" /etc/systemd/system/ && \
  sudo -n systemctl daemon-reload && sudo -n systemctl enable --now usb-host-mode && sleep 5 && \
  ok "USB-C in host mode: $(sudo -n cat /sys/kernel/debug/usb/4e00000.usb/mode)" || bad "usb-host-mode"
fi

# USB Ethernet: EEE off, link at 100 Mb/s; now and at every plug-in (see the rules file for why)
sudo -n rm -f /etc/udev/rules.d/90-domebridge-no-eee.rules   # its old name
sudo -n install -m 644 "$HOME/bridge/scripts/90-domebridge-ethernet.rules" /etc/udev/rules.d/ && \
sudo -n udevadm control --reload && \
for i in $(ls /sys/class/net); do [ "$(basename "$(readlink -f /sys/class/net/$i/device/driver)")" = r8152 ] && \
  { sudo -n ethtool --set-eee "$i" eee off; sudo -n ethtool -s "$i" speed 100 duplex full autoneg on advertise 0x008; } 2>/dev/null
done; ok "Ethernet rule installed (EEE off, 100 Mb/s)"

step "3/7 Hardware check (b0-check.sh)"
bash "$HOME/bridge/scripts/b0-check.sh" 2>&1 | tee "$LOGDIR/b0-check.txt" | tail -40

step "4/7 Rust"
if ! command -v cargo >/dev/null && [ ! -x "$HOME/.cargo/bin/cargo" ]; then
  curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal > /dev/null && ok "rustup installed" || bad "rustup failed"
fi
. "$HOME/.cargo/env" 2>/dev/null; cargo --version || bad "no cargo"
export CARGO_BUILD_JOBS=3        # 4 cores, 4 GB RAM: leave one core and some memory free

step "5/7 Statime (teodly fork, inferno-dev)"
cd "$HOME"
[ -d statime/.git ] || git clone -q --recurse-submodules -b inferno-dev https://github.com/teodly/statime.git || bad "clone statime"
( cd statime && git submodule update --init --recursive -q && time cargo build --release 2>&1 | tail -3 )
[ -x "$HOME/statime/target/release/statime" ] && ok "statime built" || bad "statime binary missing"

step "6/7 Inferno (with submodules)"
cd "$HOME"
[ -d inferno/.git ] || git clone -q --recurse-submodules https://github.com/teodly/inferno.git || bad "clone inferno"
( cd inferno && git submodule update --init --recursive -q && time cargo build --release 2>&1 | tail -3 )
[ -f "$HOME/inferno/target/release/libasound_module_pcm_inferno.so" ] && ok "Inferno ALSA plugin built" || bad "libasound_module_pcm_inferno.so missing"

step "7/7 Bridge receiver smoke test (no network sender, no Dante)"
python3 -c "import numpy; print('numpy', numpy.__version__)" || bad "numpy"
timeout 6 python3 "$HOME/bridge/rx/domebridge_rx.py" --sink null --log-every 2 2>&1 | tail -4
command -v aplay >/dev/null && ok "aplay present" || bad "aplay missing"

step "DONE in $(( ($(date +%s) - t0) / 60 )) min"
grep -E "^(OK|PROBLEM):" "$LOG"
