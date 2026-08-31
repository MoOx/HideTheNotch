#!/usr/bin/env bash
#
# Creates the emulator the Play deck is composed against, and nothing else.
#
#   npm run avd
#   HTN_API=34 HTN_AVD=htn-pixel tools/marketing/create-avd.sh
#
# The deck's Android shots are drawn for the app's own `punch-c` preset, which
# is 412 x 915 points at density 2.625, so 1080 x 2400 pixels at 420 dpi. That
# is a Pixel 6, 7 or 8, and one of those covers the whole listing.
#
# API 35 by default. 33 is the floor: per app languages arrived in Android 13,
# and the capture script sets the app's language rather than the phone's.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=/dev/null
. "$ROOT/tools/marketing/android-env.sh"

NAME="${HTN_AVD:-htn-pixel}"
API="${HTN_API:-35}"
# Apple Silicon runs arm64 images natively and x86_64 ones not at all.
case "$(uname -m)" in
  arm64|aarch64) ARCH="arm64-v8a" ;;
  *) ARCH="x86_64" ;;
esac
IMAGE="system-images;android-$API;google_apis;$ARCH"

if [ ! -x "$SDKMANAGER" ] && ! command -v sdkmanager >/dev/null 2>&1; then
  echo "No sdkmanager. It ships in the SDK's command line tools, which Android"
  echo "Studio does not install by default:"
  echo "  Android Studio > Settings > Languages & Frameworks > Android SDK"
  echo "  > SDK Tools > Android SDK Command-line Tools (latest)"
  [ -n "$SDK" ] && echo "SDK found at $SDK" || echo "No SDK found either; set ANDROID_HOME."
  exit 1
fi

if "$EMULATOR" -list-avds 2>/dev/null | grep -qx "$NAME"; then
  echo "$NAME already exists. Delete it first to start over:"
  echo "  $AVDMANAGER delete avd -n $NAME"
  exit 0
fi

# `yes |` is the usual way to answer the licence prompt, and under `pipefail` it
# is also a way to fail a step that worked: the tool exits first, `yes` takes a
# SIGPIPE, and the pipeline reports 141. So the status of the right hand side is
# the only one read here. Output is left on screen: this downloads more than a
# gigabyte and a silent quarter of an hour is indistinguishable from a hang.
piped() {
  local input="$1"; shift
  set +o pipefail
  printf '%s\n' "$input" | "$@"
  local status=${PIPESTATUS[1]}
  set -o pipefail
  return "$status"
}

# A Pixel, for the punch hole, at the one resolution the deck is built on.
#
# 1080 x 2400 at 420 dpi is what the app's `punch-c` preset describes and what
# the Play deck composes against, so the profile has to be a phone of exactly
# that screen. Pixel 6, 7 and 8 all are. Pixel 9 and 10 are not: the 10 Pro is
# 1280 x 2856 at 480 dpi, which is a different device in every number that
# matters here, and following it would mean moving the preset, the deck's
# metrics and the wallpapers with it.
#
# The punch hole itself is worth having. The emulator renders it, the app draws
# the mask that hides it, and the screenshot then shows the app doing its one
# job on a screen that has the problem.
PROFILE="${HTN_PROFILE:-}"
if [ -z "$PROFILE" ]; then
  for want in pixel_8 pixel_7 pixel_6; do
    if "$AVDMANAGER" list device 2>/dev/null | grep -q "id: .*$want"; then
      PROFILE="$want"
      break
    fi
  done
  PROFILE="${PROFILE:-pixel_6}"
fi

echo "==> installing $IMAGE"
echo "    a system image is about 1.5 GB, once"
piped y "$SDKMANAGER" --install "$IMAGE" "platform-tools" "emulator"

# Both may have arrived a moment ago, on a machine that had neither.
EMULATOR="$(pick emulator "$SDK/emulator/emulator")"
ADB="$(pick adb "$SDK/platform-tools/adb")"

echo "==> creating $NAME from $PROFILE"
piped no "$AVDMANAGER" create avd -n "$NAME" -k "$IMAGE" -d "$PROFILE"

# The profile already carries the Pixel's screen, but an AVD is free to be
# edited afterwards and a deck composed at the wrong density is a deck that has
# to be shot again, so the three numbers that matter are written down here.
CONFIG="$HOME/.android/avd/$NAME.avd/config.ini"
if [ -f "$CONFIG" ]; then
  set_ini() {
    grep -v "^$1=" "$CONFIG" > "$CONFIG.tmp" || true
    echo "$1=$2" >> "$CONFIG.tmp"
    mv "$CONFIG.tmp" "$CONFIG"
  }
  set_ini hw.lcd.width 1080
  set_ini hw.lcd.height 2400
  set_ini hw.lcd.density 420
  set_ini hw.keyboard yes
  set_ini disk.dataPartition.size 6G
fi

# An AVD that was not created is worth saying out loud, rather than leaving the
# capture run to discover it in ten minutes' time.
if ! "$EMULATOR" -list-avds 2>/dev/null | grep -qx "$NAME"; then
  echo
  echo "$NAME was not created. The output above says why."
  exit 1
fi

echo
echo "Created $NAME: $PROFILE, API $API, $ARCH, 1080 x 2400 at 420 dpi."
echo "npm run captures:android boots it on its own from here."
