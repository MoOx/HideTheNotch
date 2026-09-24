#!/usr/bin/env bash
#
# Runs the Maestro flows in .maestro/ against a release build on a simulator
# or an emulator that is already booted.
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
# it starts, pages through the families, imports a photo, exports, and a link
# that cannot open says so. Whether the pixels are right is `npm run verify`,
# which no UI test can see.
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

case "$PLATFORM" in
  ios)
    APP_ID=io.moox.HideTheNotch
    APP="${HTN_APP:-$(ls -d "$ROOT"/build/Build/Products/Release-iphonesimulator/*.app 2>/dev/null | head -1)}"
    if [ -z "$APP" ]; then
      echo "no simulator build, run tools/marketing/build-ios-sim.sh first" >&2
      exit 1
    fi
    xcrun simctl install booted "$APP"
    ;;
  android)
    APP_ID=io.moox.hidethenotch
    APK="${HTN_APK:-$(ls "$ROOT"/android/app/build/outputs/apk/release/*.apk 2>/dev/null | head -1)}"
    if [ -z "$APK" ]; then
      echo "no release APK, run tools/marketing/build-android.sh first" >&2
      exit 1
    fi
    adb install -r "$APK" >/dev/null
    ;;
  *)
    echo "usage: tools/e2e.sh ios|android [flow...]" >&2
    exit 1
    ;;
esac

# --platform: a simulator and an emulator can both be up, and Maestro would
# otherwise ask which one.
maestro --platform "$PLATFORM" test -e APP_ID="$APP_ID" "${FLOWS[@]}"
