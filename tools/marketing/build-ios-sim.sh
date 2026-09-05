#!/usr/bin/env bash
#
# Builds the app for an iOS simulator, unsigned, with the JS bundled in.
#
# Not `expo run:ios`: that starts Metro and stays in the foreground, so a
# capture run never reaches its first screenshot and the terminal has to be
# interrupted by hand. A Release build carries its own bundle and needs no
# server at all, which is also what makes the captured build the shipped one.
#
# Run twice in a row it does almost nothing the second time: the native project
# is only regenerated when what decides it has changed, the pods only when the
# Podfile has, and xcodebuild keeps its derived data. What is left is the JS
# bundle and the link, because those depend on the source you just edited.
#
#   tools/marketing/build-ios-sim.sh      # incremental
#   HTN_REBUILD=1 ...                     # from scratch, when in doubt
#
# Prints the path of the .app it produced, so a caller can pipe it onward.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# A capture build is photographed and thrown away, so its source maps are noise
# in Sentry and its upload is a network call that can fail. It did: both halves
# of the first `[store]` run died here, iOS on the "Bundle React Native code and
# images" phase and Android on `createBundleReleaseJsAndAssets_SentryUpload`,
# because a capture run carries no `SENTRY_AUTH_TOKEN` and sentry-cli exits 1
# rather than shrugging. Nothing in a deck is ever symbolicated, so the upload
# is not skipped reluctantly: it should never have run.
#
# The release lanes are untouched, which is where a source map is worth having.
export SENTRY_DISABLE_AUTO_UPLOAD=true
cd "$ROOT"
# shellcheck source=/dev/null
. tools/marketing/stamp.sh

# Which Xcode, printed because it has already decided once whether the app runs
# at all: against the iOS 27 SDK an app must adopt the UIScene life cycle, which
# neither Expo 57 nor React Native 0.86 does, and the result is a launch with
# nothing drawn. plugins/withUIScene.cjs adds what they do not.
#
#   HTN_XCODE=/Applications/Xcode_26.app npm run captures:ios
if [ -n "${HTN_XCODE:-}" ]; then
  export DEVELOPER_DIR="$HTN_XCODE/Contents/Developer"
fi

echo "==> $(xcodebuild -version | head -1), $(xcrun --sdk iphonesimulator --show-sdk-version) simulator SDK"

FORCE="${HTN_REBUILD:-}"

# The native project is a function of the Expo config and the dependency list.
# Nothing else in the repository can change what prebuild writes.
if [ -n "$FORCE" ] || [ ! -d ios ] || changed prebuild app.json package.json; then
  npx expo prebuild --platform ios --no-install
  keep prebuild
else
  echo "==> ios/ is current, skipping prebuild"
fi

if [ -n "$FORCE" ] || [ ! -d ios/Pods ] || changed pods ios/Podfile ios/Podfile.lock; then
  npx pod-install
  keep pods
else
  echo "==> pods are current, skipping"
fi

WORKSPACE=$(ls -d ios/*.xcworkspace | head -1)
SCHEME=$(basename "$WORKSPACE" .xcworkspace)

# ONLY_ACTIVE_ARCH is the expensive default here: a Release configuration builds
# every simulator slice, and a capture only ever runs on this machine's own.
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphonesimulator \
  -derivedDataPath build \
  ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO \
  build

ls -d build/Build/Products/Release-iphonesimulator/*.app | head -1
