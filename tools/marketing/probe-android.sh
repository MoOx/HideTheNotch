#!/usr/bin/env bash
#
# Three screenshots and four facts, for the status bar that comes out clipped.
#
#   tools/marketing/probe-android.sh
#
# The status bar is drawn by SystemUI, in SystemUI's process. Nothing in this
# app can move it, clip it or resize it, so a clipped one is either the demo
# mode we turn on to freeze the clock, or the emulator's own idea of how tall
# its status bar is. These three shots separate the two: if the launcher is
# clipped with demo mode off, the app was never involved.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=/dev/null
. "$ROOT/tools/marketing/android-env.sh"

PKG="${HTN_PKG:-io.moox.hidethenotch}"
OUT="$ROOT/build/probe"
mkdir -p "$OUT"

demo() { "$ADB" shell am broadcast -a com.android.systemui.demo "$@" >/dev/null; }

shot() {
  sleep 2
  "$ADB" exec-out screencap -p > "$OUT/$1.png"
  echo "    $OUT/$1.png"
}

echo "==> launcher, demo mode off"
demo -e command exit
"$ADB" shell input keyevent KEYCODE_HOME >/dev/null
shot 1-launcher-plain

echo "==> launcher, demo mode on"
"$ADB" shell settings put global sysui_demo_allowed 1 >/dev/null
demo -e command enter
demo -e command clock -e hhmm 0941
demo -e command battery -e level 100 -e plugged false
demo -e command network -e wifi show -e level 4
demo -e command network -e mobile show -e datatype none -e level 4
demo -e command notifications -e visible false
shot 2-launcher-demo

echo "==> the app, demo mode on"
"$ADB" shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 5
shot 3-app-demo

FACTS="$OUT/facts.txt"
{
  echo "== wm size / density"
  "$ADB" shell wm size
  "$ADB" shell wm density
  echo
  echo "== display cutout and insets"
  "$ADB" shell dumpsys window displays | sed -n '1,40p'
  echo
  echo "== status bar height, as the framework has it"
  "$ADB" shell dumpsys window | grep -i -m 5 "cutout\|stable\|statusBar" || true
  echo
  echo "== build"
  "$ADB" shell getprop ro.build.version.release
  "$ADB" shell getprop ro.product.model
  "$ADB" shell getprop ro.sf.lcd_density
} > "$FACTS" 2>&1
echo "==> $FACTS"
echo
echo "Send the three PNGs and facts.txt."
