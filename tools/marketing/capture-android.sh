#!/usr/bin/env bash
#
# Photographs the deck's states on an Android emulator or a plugged in device.
#
# Same idea as capture-ios.sh: the app arrives at each state from a URL, and the
# ids come from src/demo/shots.ts rather than from a second list here.
#
#   tools/marketing/capture-android.sh
#   HTN_APK=android/app/build/outputs/apk/release/app-release.apk \
#     tools/marketing/capture-android.sh
#
# Output: marketing/captures/android/<lang>/<id>.png
#
# The knobs, and the run to reach for when something is wrong. A full pass is
# six languages by five shots on a cold booted emulator, which is not a thing to
# iterate on:
#
#   HTN_SERIAL=emulator-5554 HTN_LOCALES=en HTN_SHOTS=02-import \
#     tools/marketing/capture-android.sh
#
# `HTN_SERIAL` uses an emulator that is already up, which skips the cold boot.
# `HTN_LOCALES` and `HTN_SHOTS` are space separated and narrow the two loops.
# `HTN_DEMO=0` leaves the real status bar alone, `HTN_APK` installs a build
# first, `HTN_SETTLE` and `HTN_TIMEOUT` are the two durations.
#
# When the app itself misbehaves, this is the only thing that says why:
#
#   adb logcat -c && adb logcat | grep -iE "hidethenotch|AndroidRuntime|ReactNative"
set -euo pipefail

# `set -e` with no trap is a script that stops without saying where. Every step
# here shells out to something that can fail for its own reasons, and a silent
# exit in the middle of a capture run is indistinguishable from a hang.
trap 'echo "!! stopped at line $LINENO, exit $?" >&2' ERR

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=/dev/null
. "$ROOT/tools/marketing/android-env.sh"
# shellcheck source=/dev/null
. "$ROOT/tools/marketing/shoot.sh"

PKG="${HTN_PKG:-io.moox.hidethenotch}"
OUT="${HTN_OUT:-$ROOT/marketing/captures/android}"
# How long to keep looking for the app's own "on screen" line, and how long to
# let the picture settle afterwards.
#
# This used to be a flat seven seconds of hoping, which is where the black
# screenshots came from: a cold start on an emulator is not a constant, and a
# capture run that guesses will eventually guess wrong. The app now says when
# the state it was asked for is actually on screen, sheet animation and photo
# decode included. It says it on the log, because that is the only channel adb
# has against a release build: nothing in the app's own container is readable
# from here without run-as, and run-as needs a debuggable build.
TIMEOUT="${HTN_TIMEOUT:-40}"
SETTLE="${HTN_SETTLE:-0.6}"
# Which cutout the emulator is made to have, as an AOSP overlay package.
#
# An AVD has no hole in its screen, and an app that hides one has nothing to
# show on a screen that has none. This used to be worked around from the app's
# side, with a device preset named in the URL, which meant the deck showed a
# mask cut for a phone the picture was not of: the black was there, the hole it
# covers was not, and the status bar was laid out as if the screen were solid.
#
# The emulator can grow a real one instead. These overlays are what the
# "Display cutout" developer option switches between, they are part of the
# system image, and turning one on changes what `DisplayCutout` reports, which
# is where the app reads the hole from. So the capture is of a phone with a
# camera in its screen, and the app finds it the way it finds a real one.
#
# Measured on an API 35 arm64 image at 1080 x 2400, because the names do not say
# where the hole is and the one this used to pick says the opposite of where it
# puts it:
#
#   emu01      centred punch hole, 479..601 x 0..132, what the Play deck wants
#   hole       punch hole in the top left corner, 0..136 x 0..136
#   corner     corner cutout on the right, 954..1080 x 0..126
#   double     a bar across the top and another across the bottom
#   tall       a wide notch, centred, 414..666 x 0..126
#   waterfall  curved edges, no cutout at all
#
# `emu01` is also what this image reports with every overlay off, so turning it
# on asserts the geometry rather than changing it. `hole` was the default here
# and it is the one wrong answer: it moves the camera into the top left corner,
# the app masks the top left, the status bar is laid out around the corner, and
# the deck then draws its own hole in the middle of a phone whose black is not
# there.
#
# HTN_CUTOUT=0 leaves the screen alone, which is what a run against a real
# phone wants.
CUTOUT="${HTN_CUTOUT:-emu01}"
LOCALES="${HTN_LOCALES:-en fr de es ja zh-Hans}"

mkdir -p "$OUT"

# Which device this run talks to, which is not "whichever one answers".
#
# A phone plugged in for something else is still a device to adb, and it will
# take the whole capture run without anyone noticing: a Huawei replying to
# `cmd locale` with "Can't find service: locale" is what that looks like from
# here. The emulator is what the Play deck is composed against, so it wins by
# default, and every command below is addressed to it by serial.
#
# HTN_SERIAL names something else, a real phone included.
emulators() {
  "$ADB" devices | awk 'NR > 1 && $2 == "device" && $1 ~ /^emulator-/ { print $1 }'
}

SERIAL="${HTN_SERIAL:-$(emulators | head -1)}"
if [ -z "$SERIAL" ]; then
  AVD="${HTN_AVD:-$("$EMULATOR" -list-avds 2>/dev/null | head -1)}"
  if [ -z "$AVD" ]; then
    echo "No emulator running, and no AVD to start one from."
    echo
    echo "  npm run avd     creates the one this deck is composed against,"
    echo "                  a Pixel at 1080 x 2400, and nothing else"
    echo
    echo "HTN_SERIAL=<serial> shoots on a device you have plugged in instead."
    exit 1
  fi
  # Cold, every time. `-no-snapshot-save` still *loads* the quick boot snapshot,
  # and a snapshot restores SystemUI along with everything else: a status bar
  # laid out for the screen the AVD had when the snapshot was taken, in a window
  # sized for the screen it has now. That is what sliced the clock in half
  # across every shot for days, and why restarting the emulator by hand made it
  # go away. A capture run is meant to be reproducible, so it starts from a boot
  # rather than from whatever state was lying around.
  echo "==> cold booting $AVD, which takes a minute"
  "$EMULATOR" -avd "$AVD" -no-snapshot -no-boot-anim >/dev/null 2>&1 &

  waited=0
  until [ -n "$SERIAL" ] || [ "$waited" -ge 240 ]; do
    sleep 2
    waited=$((waited + 2))
    SERIAL=$(emulators | head -1)
  done
  if [ -z "$SERIAL" ]; then
    echo "$AVD never appeared in adb devices after ${waited}s."
    exit 1
  fi
fi

# Every adb command below is addressed to this one device, never to "whichever
# one answers".
ON="-s $SERIAL"
echo "==> device $SERIAL"

# Connected is not the same as ready: adb answers as soon as the daemon sees the
# device, and the system is still coming up behind it.
waited=0
until [ "$("$ADB" $ON shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
  if [ "$waited" -ge 240 ]; then
    echo "$SERIAL never finished booting."
    exit 1
  fi
  sleep 2
  waited=$((waited + 2))
done
echo "==> ready after ${waited}s"

if [ -n "${HTN_APK:-}" ]; then
  echo "==> installing $HTN_APK"
  "$ADB" $ON install -r "$HTN_APK" >/dev/null
fi

# The status bar, and the six lines it takes.
#
# Two rules, both measured on a live emulator, and between them they account for
# every contradictory conclusion this file has carried about demo mode.
#
# One: `enter` does not reset a session that is already in demo mode, and a
# `network` command sent into a live one adds a glyph beside the one that is
# there rather than replacing it. That is where the second wifi came from, and
# it is why this exits first, waits for the exit to land, and sends `network`
# exactly once per `enter`.
#
# Two: `enter` alone is not enough, whatever the bar looks like in the second
# after it. The demo network state does not survive a SystemUI restart, and the
# cutout overlay above causes one. Left with no wifi icon, Android 15 waits
# about ten seconds and then draws a satellite, which is its way of writing "no
# service", and a run that shot sooner never saw it coming. Wifi shown and
# mobile hidden, asserted once, comes back through the restart intact.
#
# So: a fixed clock, no notifications, since demo mode raises one of its own on
# `enter`, two overlapping squares next to the clock, a full battery, and one
# wifi.
#
# Anything added here should be checked against the bar twenty seconds later,
# not against the documentation, and not one second after the broadcast.
#
# HTN_DEMO=0 leaves the real bar alone, real clock included.
demo() { "$ADB" $ON shell am broadcast -a com.android.systemui.demo "$@" >/dev/null; }

# The hole in the screen, before the app is ever launched.
#
# It is a configuration change, so it restarts SystemUI and every running
# activity. Nothing of ours is on screen yet, and the app reads the cutout once
# at launch, so this has to be settled before the first shot starts one.
#
# It fails loudly on purpose. A capture run that quietly produced a deck of an
# app hiding nothing is exactly the kind of thing nobody notices until it is on
# the store.
OVERLAY="com.android.internal.display.cutout.emulation.$CUTOUT"
if [ "$CUTOUT" != "0" ]; then
  echo "==> cutout $CUTOUT"
  if ! "$ADB" $ON shell cmd overlay list 2>/dev/null | grep -q "$OVERLAY"; then
    echo "$SERIAL has no $OVERLAY."
    echo
    echo "  The cutout overlays ship with the system image. A device that has"
    echo "  none is either a real phone, which needs HTN_CUTOUT=0 and a real"
    echo "  hole, or a system image without them."
    exit 1
  fi
  "$ADB" $ON shell cmd overlay enable "$OVERLAY" >/dev/null
  # Enabling is asynchronous, and the app reads the cutout once at launch.
  until "$ADB" $ON shell cmd overlay dump "$OVERLAY" 2>/dev/null | grep -q "mState.*STATE_ENABLED"; do
    sleep 0.5
  done
fi

# The system's own dialogs, which are the one thing a capture run cannot argue
# with once they are on screen.
#
# Every one of the thirty Android shots in the first complete run carried
# "Pixel Launcher isn't responding" across the middle of the phone. Not our app:
# the launcher, which a cold booted emulator under thirty app starts is entitled
# to lose patience with. Nothing caught it. `steady_shot` compares two shots for
# stillness and weighs the file for blackness, and a dialog is perfectly still
# and perfectly opaque, so it passed both and went into the deck.
#
# `hide_error_dialogs` is the preventive half: the framework skips the crash and
# ANR dialogs entirely rather than drawing them. It is not a promise, so the
# focus check below is the half that is.
"$ADB" $ON shell settings put global hide_error_dialogs 1 >/dev/null

if [ "${HTN_DEMO:-1}" != "0" ]; then
  "$ADB" $ON shell settings put global sysui_demo_allowed 1 >/dev/null
  demo -e command exit
  # `exit` is a broadcast, so it is a request rather than a fact. An `enter`
  # sent in the same breath lands while the old session is still up, which is
  # not an entry at all, and the `network` command below then duplicates the
  # wifi it was supposed to set. A second and a half is plenty; nothing here
  # is in a hurry.
  sleep 1.5
  demo -e command enter
  demo -e command clock -e hhmm 0941
  demo -e command notifications -e visible false
  demo -e command battery -e level 100 -e plugged false
  demo -e command network -e wifi show -e level 4 -e mobile hide
else
  demo -e command exit
fi

# The photo a shot asks for is carried by the app, see `shotPhoto` in App.tsx.
# It used to be pushed here, first to `/sdcard/Pictures` with a `pm grant`, then
# to the app's own external files directory with a chmod, and neither can work:
# `adb` cannot write to the app's internal directories, which are the only two
# expo grants read on outright, and a file pushed anywhere under `/sdcard` is
# judged by a FUSE view that answers by calling package rather than by Unix
# mode. It came out `-rw-r--r--` and unreadable.

# Whether the app is what the screen is showing, which is not the same question
# as whether the app is running.
#
# `mCurrentFocus` names the window on top, and with the app up it reads
# `io.moox.hidethenotch/io.moox.hidethenotch.MainActivity`. Anything else means
# something is in front: a system dialog, a permission prompt, the launcher.
# Whatever it is, a screenshot taken now is a picture of it.
focused_on_app() {
  "$ADB" $ON shell dumpsys window 2>/dev/null | grep -q "mCurrentFocus.*$PKG/"
}

# Back dismisses a system dialog, and the framework puts the app back in front.
# Three goes, then the run stops: a deck of error dialogs is worse than no deck,
# and it is exactly the kind of thing that is noticed on the store rather than
# here.
settle_focus() {
  local n=0
  until focused_on_app; do
    if [ "$n" -ge 3 ]; then
      echo
      echo "!! something is in front of the app and will not go:"
      "$ADB" $ON shell dumpsys window 2>/dev/null | grep -m1 "mCurrentFocus" | sed 's/^/     /'
      echo
      echo "   A screenshot taken now is a picture of that, not of the app."
      echo "   Stopping rather than writing it into the deck."
      echo
      # What the dialog would have said, since it was turned off above.
      #
      # `hide_error_dialogs` is worth having and it takes the diagnosis with it:
      # an app that crashes leaves the launcher in front and no message at all,
      # which reads exactly like an app that was never launched. The log still
      # knows, so it is printed here rather than left for whoever reruns this
      # with the setting off.
      echo "   The log, in case it died rather than lost focus:"
      "$ADB" $ON logcat -d -t 400 2>/dev/null \
        | grep -iE "FATAL EXCEPTION|AndroidRuntime|ANR in|Force finishing|died|$PKG.*(crash|kill)" \
        | tail -25 | sed 's/^/     /' \
        || echo "     nothing in it about a crash"
      exit 1
    fi
    printf '    ! %s in front, dismissing\n' \
      "$("$ADB" $ON shell dumpsys window 2>/dev/null | grep -m1 mCurrentFocus | sed 's/.*u0 //; s/\/.*//' | tr -d '\r}')"
    "$ADB" $ON shell input keyevent KEYCODE_BACK >/dev/null
    sleep 1
    n=$((n + 1))
  done
}

# The ids come from the deck's own list, so adding a shot there is enough.
# `HTN_SHOTS` narrows it, which is the difference between a thirty shot run and
# a one shot one when something needs looking at.
IDS="${HTN_SHOTS:-$(grep -o 'id: "[^"]*"' "$ROOT/src/demo/shots.ts" | cut -d'"' -f2)}"

# Android 13 and up carry a per app language, which is exactly the right knob:
# the device stays in whatever language it was in, and nothing has to be put
# back afterwards.
tag_for() {
  case "$1" in
    en) echo "en-US" ;;
    fr) echo "fr-FR" ;;
    de) echo "de-DE" ;;
    es) echo "es-ES" ;;
    ja) echo "ja-JP" ;;
    zh-Hans) echo "zh-Hans-CN" ;;
    *) echo "en-US" ;;
  esac
}

for lang in $LOCALES; do
echo
echo "==== $lang ===="
mkdir -p "$OUT/$lang"
# Whatever it has to say, and its failure is not the run's: under `pipefail` a
# non-zero here was ending the whole capture without printing a word, which is
# a diagnostic line killing the thing it was added to diagnose.
said=$("$ADB" $ON shell cmd locale set-app-locales "$PKG" --locales "$(tag_for "$lang")" 2>&1 \
  | tr -d '\r' || true)
if [ -n "$said" ]; then echo "  ! cmd locale: $said"; fi

for id in $IDS; do
  echo "==> $id"
  # Every shot is a cold start, which is the only way the language is the one
  # just asked for. The app reads it once, when the bundle is evaluated, and a
  # bundle is evaluated once per process: the system restarts the activity when
  # the per app locale changes, but the process lives on, so a warm app keeps
  # answering in the language it was launched in. Without this, all six
  # directories come out in whichever language ran first.
  "$ADB" $ON shell am force-stop "$PKG" >/dev/null
  # Cleared, so the line we find is this launch's and not the last one's.
  "$ADB" $ON logcat -c >/dev/null 2>&1 || true
  # The URL carries the shot id and nothing else. It is a public scheme, so
  # nothing in it is allowed to name a file.
  "$ADB" $ON shell am start -a android.intent.action.VIEW \
    -d "hidethenotch://shot/$id" >/dev/null

  waited=0
  until "$ADB" $ON logcat -d -s ReactNativeJS:V 2>/dev/null | grep -q "HTN-READY $id"; do
    if [ "$waited" -ge "$((TIMEOUT * 4))" ]; then
      printf '    ! no answer after %ss, shooting anyway\n' "$TIMEOUT"
      break
    fi
    sleep 0.25
    waited=$((waited + 1))
  done
  printf '    on screen after %ss\n' "$(echo "scale=1; $waited / 4" | bc)"

  sleep "$SETTLE"
  take() { "$ADB" $ON exec-out screencap -p > "$1"; }

  # Before, because a dialog that is already up is what the shot would be of.
  settle_focus
  steady_shot "$OUT/$lang/$id.png"
  # And after, because one that arrives mid shot is the same picture.
  if ! focused_on_app; then
    echo "    ! a dialog arrived during the shot, retaking"
    settle_focus
    steady_shot "$OUT/$lang/$id.png"
  fi
done
done

"$ADB" $ON shell cmd locale set-app-locales "$PKG" --locales "" >/dev/null 2>&1 || true

demo -e command exit
"$ADB" $ON shell settings delete global hide_error_dialogs >/dev/null 2>&1 || true

# The screen goes back to being solid, so the next thing to use this emulator
# gets it as it was.
if [ "$CUTOUT" != "0" ]; then
  "$ADB" $ON shell cmd overlay disable "$OVERLAY" >/dev/null 2>&1 || true
fi

# Stamp what the interface looked like, so a later deck can tell whether these
# still show this app. See tools/marketing/fingerprint.cjs.
#
# Only a complete run gets to say that. A narrowed one leaves the stamp alone,
# or five shots in one language would claim to speak for thirty.
if [ -z "${HTN_SHOTS:-}" ] && [ "$LOCALES" = "en fr de es ja zh-Hans" ]; then
  node "$ROOT/tools/marketing/fingerprint.cjs" --write android
else
  echo "==> partial run, fingerprint left alone"
fi

echo
echo "Captured into $OUT:"
ls -1 "$OUT"/*/ | head -40
