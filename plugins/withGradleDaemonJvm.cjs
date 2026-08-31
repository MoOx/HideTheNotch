// One JVM for the Android build, the one you chose.
//
// `expo prebuild` writes `android/gradle/gradle-daemon-jvm.properties` asking
// for a JDK that has nothing to do with the one on the machine. Gradle takes it
// at its word, provisions that JDK into `~/.gradle/jdks` when it is missing,
// and runs the daemon in it, so `JAVA_HOME` decides the launcher and nothing
// else. AGP then runs the prefab CLI with the daemon's JVM:
//
//   ~/.gradle/jdks/eclipse_adoptium-25-.../bin/java --class-path .../cli-2.1.0-all.jar
//
// On JDK 24 and later that process writes the JEP 472 warning ("a restricted
// method in java.lang.System has been called") into its own output, exits 0,
// and AGP reads that output line by line and throws on the first line it does
// not recognise. Three modules then fail to configure over a warning about
// nothing, on a build where a perfectly good JDK 17 or 21 was selected:
//
//   Execution failed for task ':shopify_react-native-skia:configureCMakeDebug[arm64-v8a]'.
//   > WARNING: A restricted method in java.lang.System has been called
//
// Removing the file removes the second opinion. With no criteria to satisfy,
// Gradle runs the daemon in the JVM that launched it, which is `JAVA_HOME`, so
// the build, the daemon and prefab are all in the JDK that was picked on
// purpose: JDK 17 in both workflows, whatever `tools/marketing/build-android.sh`
// found locally, and whatever the shell has for `npx expo run:android`.
//
// It is a plugin rather than a line in a build script because the file comes
// out of the prebuild, and `npx expo run:android` prebuilds without going
// anywhere near our scripts.
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = (config) =>
  withDangerousMod(config, [
    "android",
    (config) => {
      const file = path.join(
        config.modRequest.platformProjectRoot,
        "gradle",
        "gradle-daemon-jvm.properties",
      );
      if (fs.existsSync(file)) {
        const asked = /^toolchainVersion=(.*)$/m.exec(fs.readFileSync(file, "utf8"));
        console.log(
          `withGradleDaemonJvm: dropping the daemon JVM criteria${
            asked ? ` (asked for Java ${asked[1]})` : ""
          }, JAVA_HOME decides`,
        );
        fs.rmSync(file);
      }
      return config;
    },
  ]);
