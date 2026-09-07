#!/usr/bin/env bash
#
# Puts a running emulator into the state the deck is shot in, and takes it out
# again. Same cutout, same status bar, no capture run around it.
#
#   tools/marketing/demo-android.sh          # centred punch hole, 9:41 bar
#   tools/marketing/demo-android.sh off      # back to a normal phone
#   HTN_CUTOUT=tall tools/marketing/demo-android.sh
#
# This exists because looking at the app on an emulator dressed like the deck is
# how most of the drawing bugs are found, and rerunning a six language capture
# to get there costs twenty minutes. `capture-android.sh` does exactly the same
# two things at the top of its run; the reasoning behind each line lives there.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=/dev/null
. "$ROOT/tools/marketing/android-env.sh"

# Centred, which the deck's phone is drawn with. `hole` is the top left corner
# whatever its name suggests. capture-android.sh lists all six with the
# rectangle each one produces.
CUTOUT="${HTN_CUTOUT:-emu01}"
OVERLAY="com.android.internal.display.cutout.emulation.$CUTOUT"

SERIAL="${HTN_SERIAL:-$("$ADB" devices | awk 'NR > 1 && $2 == "device" && $1 ~ /^emulator-/ { print $1 }' | head -1)}"
if [ -z "$SERIAL" ]; then
  echo "No emulator running. Start one, or npm run avd to create the deck's."
  exit 1
fi
ON="-s $SERIAL"
demo() { "$ADB" $ON shell am broadcast -a com.android.systemui.demo "$@" >/dev/null; }

if [ "${1:-on}" = "off" ]; then
  demo -e command exit
  for name in emu01 hole corner double tall waterfall; do
    "$ADB" $ON shell cmd overlay disable "com.android.internal.display.cutout.emulation.$name" \
      >/dev/null 2>&1 || true
  done
  echo "$SERIAL: real status bar, no forced cutout."
  exit 0
fi

if ! "$ADB" $ON shell cmd overlay list 2>/dev/null | grep -q "$OVERLAY"; then
  echo "$SERIAL has no $OVERLAY."
  exit 1
fi
"$ADB" $ON shell cmd overlay enable "$OVERLAY" >/dev/null
until "$ADB" $ON shell cmd overlay dump "$OVERLAY" 2>/dev/null | grep -q "mState.*STATE_ENABLED"; do
  sleep 0.5
done

# The overlay restarts SystemUI, and the demo network state does not survive
# that restart, so the bar is set after the hole and never before it.
"$ADB" $ON shell settings put global sysui_demo_allowed 1 >/dev/null
demo -e command exit
sleep 1.5
demo -e command enter
demo -e command clock -e hhmm 0941
demo -e command notifications -e visible false
demo -e command battery -e level 100 -e plugged false
demo -e command network -e wifi show -e level 4 -e mobile hide

echo "$SERIAL: $CUTOUT, 9:41, wifi and a full battery."
"$ADB" $ON shell dumpsys display | grep -o 'boundingRect={[^}]*}' | head -1
