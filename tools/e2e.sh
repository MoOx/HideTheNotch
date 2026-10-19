#!/usr/bin/env bash
#
# Runs the Maestro flows in .maestro/ against a release build on a simulator
# or an emulator that is already booted.
#
# Boot an Android emulator with the host GPU:
#
#   emulator -avd htn-pixel -gpu host
#
# Without it the emulator renders in software, a frame of the wallpaper takes
# seconds, and Android kills the app as not responding before a flow ends.
#
#   tools/e2e.sh ios        # installs the last iOS simulator build
#   tools/e2e.sh android    # installs the last release APK
#   HTN_APP=path/to/HideTheNotch.app tools/e2e.sh ios
#   tools/e2e.sh ios .maestro/export.yaml    # one flow
#
# Build first with tools/marketing/build-ios-sim.sh or build-android.sh: the
# same builds the store captures use, so what is tested is what ships, JS
# bundle included and no Metro involved.
#
# The flows check that the app does its job without crashing or going silent:
# it starts, pages through the families, imports a photo in each of two
# containers, exports, and a link that cannot open says so and offers the way
# out. Whether the pixels are right is `npm run verify`, which no UI test can
# see.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLATFORM="${1:-}"
shift || true
FLOWS=("$@")
[ ${#FLOWS[@]} -eq 0 ] && FLOWS=("$ROOT/.maestro")

# Maestro sends usage analytics unless told not to, and prints an upsell box
# after every run.
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

if ! command -v maestro >/dev/null; then
  echo "maestro is not installed: brew install mobile-dev-inc/tap/maestro" >&2
  exit 1
fi

# The photo flow picks from the library, and a fresh emulator's is empty. The
# flow cannot bring it itself: Maestro reads nothing outside .maestro/, links
# included, and a second copy of the asset is a second thing to keep in step.
#
# Two files, and deliberately the same picture twice. The second is a HEIC,
# which is what every iPhone shoots and what Skia has no decoder for, so the
# import only works because the picker is asked for a compatible
# representation and iOS transcodes it on the way out (see
# preferredAssetRepresentationMode in App.tsx: without it, every photo taken
# with the phone failed to open). One picture in two containers means the
# container is the only thing the flow is testing.
#
# Not an AVIF, which would be the better fixture, since that one is read by the
# system decoder rather than by the picker (Sentry HIDE-THE-NOTCH-5K).
# `simctl addmedia` refuses it: "File type unsupported", NSPOSIXErrorDomain 22,
# on iOS 27 as on anything older. A simulator's library cannot be made to hold
# one, so that path has no flow and is not pretended to have one.
PHOTOS=("$ROOT/assets/demo-photo.jpg" "$ROOT/assets/demo-photo.heic")

case "$PLATFORM" in
  ios)
    APP_ID=io.moox.HideTheNotch
    APP="${HTN_APP:-$(ls -d "$ROOT"/build/Build/Products/Release-iphonesimulator/*.app 2>/dev/null | head -1)}"
    if [ -z "$APP" ]; then
      echo "no simulator build, run tools/marketing/build-ios-sim.sh first" >&2
      exit 1
    fi
    xcrun simctl install booted "$APP"
    xcrun simctl addmedia booted "${PHOTOS[@]}"
    ;;
  android)
    APP_ID=io.moox.hidethenotch
    APK="${HTN_APK:-$(ls "$ROOT"/android/app/build/outputs/apk/release/*.apk 2>/dev/null | head -1)}"
    if [ -z "$APK" ]; then
      echo "no release APK, run tools/marketing/build-android.sh first" >&2
      exit 1
    fi
    adb install -r "$APK" >/dev/null
    for photo in "${PHOTOS[@]}"; do
      name=$(basename "$photo")
      adb push "$photo" "/sdcard/Pictures/$name" >/dev/null
      adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
        -d "file:///sdcard/Pictures/$name" >/dev/null
    done
    ;;
  *)
    echo "usage: tools/e2e.sh ios|android [flow...]" >&2
    exit 1
    ;;
esac

# --platform: a simulator and an emulator can both be up, and Maestro would
# otherwise ask which one.
maestro --platform "$PLATFORM" test -e APP_ID="$APP_ID" "${FLOWS[@]}"
