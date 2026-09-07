#!/usr/bin/env bash
#
# Photographs the deck's states on an iOS simulator.
#
# The app walks itself into each state: every one of them is a URL, so there is
# nothing to tap, no accessibility identifiers to keep in sync, and no test
# target to survive `expo prebuild --clean`. The states are src/demo/shots.ts,
# and this reads their ids from that file rather than repeating them.
#
#   tools/marketing/capture-ios.sh                        # already installed
#   HTN_APP=build/HideTheNotch.app tools/marketing/capture-ios.sh
#   HTN_DEVICE="iPhone 16 Pro" tools/marketing/capture-ios.sh
#   HTN_SETTLE=2 tools/marketing/capture-ios.sh            # slower sheets
#   HTN_TIMEOUT=40 tools/marketing/capture-ios.sh          # slower machine
#
# Output: marketing/captures/ios/<id>.png, at the simulator's native
# resolution, which is what compose.cjs wants.
set -euo pipefail

# `set -e` with no trap is a script that stops without saying where. Every step
# here shells out to something that can fail for its own reasons, and a silent
# exit in the middle of a capture run is indistinguishable from a hang.
trap 'echo "!! stopped at line $LINENO, exit $?" >&2' ERR

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=/dev/null
. "$ROOT/tools/marketing/shoot.sh"
DEVICE="${HTN_DEVICE:-iPhone 17 Pro Max}"
BUNDLE="${HTN_BUNDLE:-io.moox.HideTheNotch}"
OUT="${HTN_OUT:-$ROOT/marketing/captures/ios}"
# How long to keep looking after the app says it is ready, for the sheet
# animation to land. Not a guess at how long a cold start takes: that is what
# HTN_TIMEOUT bounds, and the app itself says when it is done.
SETTLE="${HTN_SETTLE:-0.8}"
TIMEOUT="${HTN_TIMEOUT:-25}"
# The app's own locale codes, from src/i18n/strings.ts. One capture set each.
LOCALES="${HTN_LOCALES:-en fr de es ja zh-Hans}"

mkdir -p "$OUT"

# A simulator that does not exist yet, which is most of them on a fresh machine
# and on a GitHub runner alike. Xcode creates one device per model it feels like
# and no more, so asking for an iPad on a machine that has only phones fails at
# `bootstatus` with nothing useful said.
#
# It is created rather than substituted, because the deck is composed against
# one exact screen: 2048 x 2732 is the thirteen inch Air and nothing else, and a
# deck drawn from another iPad is a deck with the wrong metrics in it. If the
# model itself is unknown to this Xcode there is nothing to do but say so.
if ! xcrun simctl list devices available | grep -qF "$DEVICE ("; then
  TYPE=$(xcrun simctl list devicetypes \
    | grep -F "$DEVICE (" \
    | sed -n 's/.*(\(com\.apple\.CoreSimulator\.SimDeviceType\.[^)]*\)).*/\1/p' \
    | head -1)
  if [ -z "$TYPE" ]; then
    echo "This Xcode has no '$DEVICE'. What it does have:"
    xcrun simctl list devicetypes | grep -iE "iphone|ipad" | sed 's/^/  /'
    exit 1
  fi
  # The identifier trails the line here rather than sitting in brackets like
  # the device type's, and the list comes out oldest first, so the newest is
  # the last one: `iOS 27.0 (27.0 - 24A5423a) - com.apple...SimRuntime.iOS-27-0`
  RUNTIME=$(xcrun simctl list runtimes ios \
    | sed -n 's/.*\(com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9-]*\).*/\1/p' \
    | tail -1)
  if [ -z "$RUNTIME" ]; then
    echo "This Xcode has no iOS runtime to create '$DEVICE' with."
    exit 1
  fi
  echo "==> creating $DEVICE on $RUNTIME"
  xcrun simctl create "$DEVICE" "$TYPE" "$RUNTIME" >/dev/null
fi

echo "==> booting $DEVICE"
xcrun simctl boot "$DEVICE" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$DEVICE" -b >/dev/null

# 9:41, full battery, full bars. Apple's own screenshots have said 9:41 since
# 2007, and a store shot with a real clock and a 37 percent battery in it looks
# like a photograph of someone's phone rather than like the product.
xcrun simctl status_bar "$DEVICE" override \
  --time "9:41" \
  --batteryState charged --batteryLevel 100 \
  --cellularMode active --cellularBars 4 \
  --wifiMode active --wifiBars 3 \
  --dataNetwork 5g

if [ -n "${HTN_APP:-}" ]; then
  echo "==> installing $HTN_APP"
  xcrun simctl install "$DEVICE" "$HTN_APP"
fi

echo "==> launching $BUNDLE"
xcrun simctl launch "$DEVICE" "$BUNDLE" >/dev/null
sleep 3

# The single source of truth is the TypeScript. Reading the ids out of it keeps
# this script from becoming a second, quietly diverging list.
IDS=$(grep -o 'id: "[^"]*"' "$ROOT/src/demo/shots.ts" | cut -d'"' -f2)

# iOS resolves the language from NSUserDefaults, and a launch argument of the
# form -Key value lands there for the life of that launch. So the language is
# chosen per launch, with no device wide setting to put back and no reboot,
# which is the same mechanism fastlane snapshot has used for a decade.
region_for() {
  case "$1" in
    en) echo "en_US" ;;
    fr) echo "fr_FR" ;;
    de) echo "de_DE" ;;
    es) echo "es_ES" ;;
    ja) echo "ja_JP" ;;
    zh-Hans) echo "zh_CN" ;;
    *) echo "en_US" ;;
  esac
}

# Not openurl: iOS hands that to SpringBoard, which asks "Open in Hide The
# Notch?" and leaves the alert sitting over the screenshot. Writing into the
# app's own container and relaunching asks the same question without anyone
# having to answer it. See the file route in App.tsx.
DATA=$(xcrun simctl get_app_container "$DEVICE" "$BUNDLE" data)

# The photograph a shot asks for is carried by the app, in `assets/`, and is
# the same file on both platforms. Nothing is pushed here: a copy used to land
# in Documents and nothing ever read it. See `shotPhoto` in App.tsx.
mkdir -p "$DATA/Documents"

for lang in $LOCALES; do
echo
echo "==== $lang ===="
mkdir -p "$OUT/$lang"

for id in $IDS; do
  printf '==> %s' "$id"
  rm -f "$DATA/Documents/htn-ready.txt"
  printf '%s' "$id" > "$DATA/Documents/htn-shot.txt"
  xcrun simctl terminate "$DEVICE" "$BUNDLE" >/dev/null 2>&1 || true
  xcrun simctl launch "$DEVICE" "$BUNDLE" \
    -AppleLanguages "($lang)" -AppleLocale "$(region_for "$lang")" >/dev/null

  # A cold start on a simulator is several seconds, and photographing it before
  # it finishes is how every one of these came out black. So wait for the app
  # to say it is on screen rather than for a number someone tuned once.
  waited=0
  while [ ! -f "$DATA/Documents/htn-ready.txt" ]; do
    if [ "$waited" -ge "$((TIMEOUT * 4))" ]; then
      printf ' (no answer after %ss, shooting anyway)' "$TIMEOUT"
      break
    fi
    sleep 0.25
    waited=$((waited + 1))
  done
  printf ' %ss\n' "$(echo "scale=1; $waited / 4" | bc)"

  sleep "$SETTLE"
  take() { xcrun simctl io "$DEVICE" screenshot --type=png "$1" >/dev/null 2>&1; }
  steady_shot "$OUT/$lang/$id.png"
done
done

# Stamp what the interface looked like, so a later deck can tell whether these
# still show this app. See tools/marketing/fingerprint.cjs.
node "$ROOT/tools/marketing/fingerprint.cjs" --write ios

echo
echo "Captured into $OUT:"
ls -1 "$OUT"/*/ | head -40
