#!/usr/bin/env bash
#
# Finds the Android SDK and the four binaries the capture pipeline uses.
# Sourced, never run: it sets SDK, ADB, EMULATOR, AVDMANAGER and SDKMANAGER.
#
# Android Studio installs all of them and puts none of them on PATH, so a
# machine where everything is correctly installed still cannot run `emulator`.

for candidate in \
  "${ANDROID_HOME:-}" \
  "${ANDROID_SDK_ROOT:-}" \
  "$HOME/Library/Android/sdk" \
  "$HOME/Android/Sdk" \
  "$HOME/AppData/Local/Android/Sdk"
do
  if [ -n "$candidate" ] && [ -d "$candidate/platform-tools" ]; then
    SDK="$candidate"
    break
  fi
done
SDK="${SDK:-}"

# PATH first when the tool is there, so a deliberate choice wins over a guess.
pick() {
  local name="$1"; shift
  local found
  found="$(command -v "$name" 2>/dev/null || true)"
  if [ -n "$found" ]; then echo "$found"; return; fi
  for p in "$@"; do
    [ -x "$p" ] && { echo "$p"; return; }
  done
  echo "$name"
}

ADB="$(pick adb "$SDK/platform-tools/adb")"
EMULATOR="$(pick emulator "$SDK/emulator/emulator")"
# cmdline-tools is versioned, and "latest" is only there when it was installed
# under that name, which is the default but not a promise.
AVDMANAGER="$(pick avdmanager \
  "$SDK/cmdline-tools/latest/bin/avdmanager" \
  $(ls -d "$SDK"/cmdline-tools/*/bin/avdmanager 2>/dev/null || true) \
  "$SDK/tools/bin/avdmanager")"
SDKMANAGER="$(pick sdkmanager \
  "$SDK/cmdline-tools/latest/bin/sdkmanager" \
  $(ls -d "$SDK"/cmdline-tools/*/bin/sdkmanager 2>/dev/null || true) \
  "$SDK/tools/bin/sdkmanager")"

export SDK ADB EMULATOR AVDMANAGER SDKMANAGER
