#!/usr/bin/env bash
#
# Builds a release APK for the capture run.
#
# Gradle is incremental on its own; the part that was not is the prebuild, which
# rewrites android/ on every call and hands Gradle a changed project. So it only
# runs when what decides it has changed.
#
# `-x lintVitalRelease` is not optional: AGP runs lintVital on release builds,
# including inside dependency modules, and it fails on react-native-skia and
# expo-modules-core for reasons unrelated to this app. Turning it off through
# the DSL does not work, AGP reads it too early. See README.md.
#
#   tools/marketing/build-android.sh
#   HTN_REBUILD=1 ...
#
# Prints the path of the APK.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=/dev/null
. tools/marketing/stamp.sh

# Which JDK. AGP supports 17 and 21, and the workflow pins 17, so this picks one
# of those when the machine has it rather than whatever is on the PATH.
#
# This used to be beside the point, and the comment here used to say so: the
# daemon ran in whatever JDK android/gradle/gradle-daemon-jvm.properties asked
# for, so choosing one here changed nothing. That file is now removed at
# prebuild time (see plugins/withGradleDaemonJvm.cjs), which makes this choice
# the one that decides the daemon, the build and the prefab CLI alike.
#
# The vendor does not matter, the major version does. Android Studio's own
# bundled JBR is a perfectly good JDK and would be the tidiest thing to use,
# but it is whatever version Android Studio ships, which today is 25, and on 24
# and later prefab writes a warning that AGP cannot read.
#
#   HTN_JAVA_HOME=/path/to/jdk-21 npm run captures:android
if [ -n "${HTN_JAVA_HOME:-}" ]; then
  export JAVA_HOME="$HTN_JAVA_HOME"
elif [ -x /usr/libexec/java_home ]; then
  for want in 17 21; do
    if found=$(/usr/libexec/java_home -v "$want" 2>/dev/null); then
      export JAVA_HOME="$found"
      break
    fi
  done
fi

JAVA_BIN="${JAVA_HOME:+$JAVA_HOME/bin/}java"
JAVA_MAJOR=$("$JAVA_BIN" -version 2>&1 | head -1 | sed -E 's/.*"([0-9]+).*/\1/')
echo "==> JDK $JAVA_MAJOR${JAVA_HOME:+ at $JAVA_HOME}"

if [ "$JAVA_MAJOR" -ge 24 ] 2>/dev/null; then
  echo "    ! AGP supports 17 and 21. Any vendor: brew install --cask temurin@21"
fi

# JAVA_HOME decides the JVM Gradle runs in. It does not decide the one AGP
# spawns for the tools it shells out to, which comes off the PATH, so a second
# JDK there is a second JDK in the build and worth naming out loud.
OTHER_JAVA="$(command -v java 2>/dev/null || true)"
if [ -n "$OTHER_JAVA" ] && [ -n "${JAVA_HOME:-}" ] && [ "$OTHER_JAVA" != "$JAVA_HOME/bin/java" ]; then
  echo "    the PATH's own java is $OTHER_JAVA, $("$OTHER_JAVA" -version 2>&1 | head -1)"
fi

# Where node is, in a way that outlives this shell.
#
# Gradle spawns `node` for autolinking, and it spawns it from the daemon, which
# cannot change its own environment once started: mutating a running process's
# environment is blocked on JDK 17 and later, so whatever PATH the daemon
# inherited on the day it started is the PATH it hands every build after that.
# With fnm or nvm that PATH entry is a per shell directory that is deleted when
# the shell exits, so a daemon left over from yesterday looks for node somewhere
# that no longer exists and the build dies during settings evaluation:
#
#   A problem occurred evaluating settings 'android'.
#   > A problem occurred starting process 'command 'node''
#
# `process.execPath` is where node is really installed, not the shim the shell
# went through, so prepending that directory gives the daemon a PATH that stays
# true for as long as the version is installed. A daemon started before this
# still holds the old one, hence the stop when the directory moves.
if ! command -v node >/dev/null 2>&1; then
  echo "No node on PATH. Gradle needs one to autolink the Expo modules."
  exit 1
fi
NODE_DIR="$(dirname "$(node -e 'console.log(process.execPath)')")"
echo "==> node $(node -v) at $NODE_DIR"

# One PATH, imposed in one place, and a daemon stopped whenever it moves.
#
# The same rule as above applies to everything, not just node: a running daemon
# cannot adopt a new environment, so changing what this script puts on the PATH
# does nothing at all until the daemon that holds the old one is gone. Stopping
# it costs one JVM start; not stopping it costs an afternoon of testing a fix
# that was never in the build.
BUILD_PATH="${JAVA_HOME:+$JAVA_HOME/bin:}$NODE_DIR"
export PATH="$BUILD_PATH:$PATH"

mkdir -p "$STAMP_DIR"
if [ "$(cat "$STAMP_DIR/build-path" 2>/dev/null || true)" != "$BUILD_PATH" ]; then
  echo "==> the build's PATH moved, stopping the daemon so it can see the new one"
  [ -d android ] && (cd android && ./gradlew --stop >/dev/null 2>&1 || true)
  printf '%s' "$BUILD_PATH" > "$STAMP_DIR/build-path"
fi

if [ -n "${HTN_REBUILD:-}" ] || [ ! -d android ] || changed prebuild-android app.json package.json; then
  npx expo prebuild --platform android --no-install
  keep prebuild-android
else
  echo "==> android/ is current, skipping prebuild"
fi

# A daemon in a JVM nobody chose, and the warning that is not the error.
#
# The prebuild writes android/gradle/gradle-daemon-jvm.properties asking for a
# JDK unrelated to the one here, Gradle provisions it, runs the daemon in it,
# and AGP runs the prefab CLI with that same JVM. On 24 and later prefab writes
# the JEP 472 warning into its own output and AGP throws on it, so three modules
# fail to configure over a warning about nothing. plugins/withGradleDaemonJvm.cjs
# removes that file at prebuild time, here and under `npx expo run:android`
# alike, which leaves JAVA_HOME as the only opinion.
#
# This stays as a net: a file put back by hand, or by `./gradlew updateDaemonJvm`,
# would quietly take the daemon somewhere else again.
DAEMON_JVM="android/gradle/gradle-daemon-jvm.properties"
if [ -n "$JAVA_MAJOR" ] && [ -f "$DAEMON_JVM" ] \
  && ! grep -q "^toolchainVersion=$JAVA_MAJOR\$" "$DAEMON_JVM"; then
  echo "==> pinning the daemon to JDK $JAVA_MAJOR, $DAEMON_JVM asked for $(sed -n 's/^toolchainVersion=//p' "$DAEMON_JVM")"
  awk -v v="$JAVA_MAJOR" '/^toolchainVersion=/ { print "toolchainVersion=" v; next } { print }' \
    "$DAEMON_JVM" > "$DAEMON_JVM.tmp"
  grep -q "^toolchainVersion=" "$DAEMON_JVM" || echo "toolchainVersion=$JAVA_MAJOR" >> "$DAEMON_JVM.tmp"
  mv "$DAEMON_JVM.tmp" "$DAEMON_JVM"
fi

# Which JVM the build is really in, as opposed to which one we asked for.
[ -d android ] && (cd android && ./gradlew -version 2>/dev/null | grep -i "JVM:" | sed 's/^/    /') || true

# Ask the failing task what it is doing, rather than what it printed last.
#
#   HTN_DIAGNOSE=1 tools/marketing/build-android.sh
#   HTN_DIAGNOSE=1 HTN_TASK=:expo-updates:configureCMakeRelWithDebInfo ...
#
# `--info` logs the command line of every process the task starts and the whole
# of what each one wrote, which is where the four lines around a JDK integrity
# warning live: the first says a restricted method was called, the second says
# which class called it and from which module, and that is the name of whatever
# is really running. The full log stays on disk; only the slices worth reading
# are printed.
if [ -n "${HTN_DIAGNOSE:-}" ]; then
  TASK="${HTN_TASK:-:react-native-worklets:configureCMakeRelWithDebInfo}"
  LOG="build/android-diagnose.log"
  mkdir -p build
  echo "==> $TASK, with --info, into $LOG"
  (cd android && ./gradlew "$TASK" --rerun --stacktrace --info) > "$LOG" 2>&1 || true

  echo
  echo "--- the JVMs in play"
  grep -iE "(launcher|daemon) jvm|java\.home|Starting process .*(java|prefab)" "$LOG" | head -20 || true
  echo
  echo "--- around the warning"
  grep -n -B 6 -A 12 "restricted method" "$LOG" | head -60 || true
  echo
  echo "--- the failure"
  grep -n -A 30 "Execution failed for task\|^Caused by" "$LOG" | head -60 || true
  echo
  echo "full log: $LOG"
  exit 1
fi

# The native configure state lives outside android/build, in a .cxx directory
# per module, and it survives everything short of being deleted. A configure
# that failed once will keep reporting the same failure from there.
clear_native_state() {
  echo "==> clearing the native configure state"
  find android node_modules -maxdepth 4 -type d -name ".cxx" -exec rm -rf {} + 2>/dev/null || true
}

if [ -n "${HTN_REBUILD:-}" ]; then
  clear_native_state
  (cd android && ./gradlew clean >/dev/null)
fi

GRADLE_FLAGS=""
[ -n "${HTN_DEBUG:-}" ] && GRADLE_FLAGS="--stacktrace --info"

build() {
  # shellcheck disable=SC2086
  (cd android && ./gradlew assembleRelease -x lintVitalRelease $GRADLE_FLAGS)
}

# AGP reports the last line a native tool wrote as the reason the task failed,
# which is how "WARNING: A restricted method in java.lang.System has been
# called" ends up standing in for an error it says nothing about. The tools
# themselves write to disk, next to the configure state, and that is the file
# worth reading.
native_logs() {
  local logs
  # The stderr file is the one the failing task wrote. CMakeError.log is a
  # different thing: CMake writes it while probing the compiler, it records
  # checks that are meant to fail, and it stays behind from earlier configures,
  # so it is a fallback and never the headline.
  logs=$(find android node_modules -maxdepth 9 -type f -path "*.cxx*" \
    -name "metadata_generation_stderr.txt" -size +0 2>/dev/null || true)
  [ -z "$logs" ] && logs=$(find android node_modules -maxdepth 9 -type f \
    -path "*.cxx*" -name "CMakeError.log" -size +0 2>/dev/null || true)
  [ -z "$logs" ] && return 0
  echo
  echo "==> what the native step actually wrote"
  # shellcheck disable=SC2086
  for f in $(ls -t $logs 2>/dev/null | head -3); do
    echo "--- $f"
    tail -40 "$f"
  done
}

if ! build; then
  native_logs
  if [ -n "${HTN_REBUILD:-}" ]; then
    exit 1
  fi
  # Twice now, a failing `configureCMake` has been a stale .cxx and nothing
  # else, and the only way to tell that from a real failure is to take it out
  # and see. Once, then the failure is the failure.
  echo
  echo "==> retrying once without the old native configure state"
  clear_native_state
  build || { native_logs; exit 1; }
fi

ls android/app/build/outputs/apk/release/*.apk | head -1
