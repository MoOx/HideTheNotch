# Store deck, prototype

Generates App Store and Play Store artwork out of the app's own rendering code.
The study behind it, including what fastlane can and cannot do and what is still
missing, is in [`docs/2026-store-marketing-automation.md`](../../docs/2026-store-marketing-automation.md).

On your own machine, five commands, and the first one only once:

```sh
npm run avd                # once: the emulator the Play deck is composed against
npm run captures:ios       # builds for a simulator, walks the states, shoots
npm run captures:android   # same, booting the emulator if none is running
npm run deck               # both decks, straight from the captures
npm run marketing:serve    # the same decks in a browser, live
```

Or let CI do the first four and bring the result down:

```sh
npm run deck:fetch         # the deck from the last successful Store captures run
```

Both halves need a toolchain each (Xcode, Android Studio) and about forty
minutes; `store-captures.yml` has both on free public runners, and leaves the
two sets of captures and the composed decks as run artefacts. Artefacts do not
travel on their own, though: the deck job downloads the captures inside its own
run, and nothing outside that run does. `deck:fetch` is the outside.

| Artefact | What | Kept |
| -------- | ---- | ---- |
| `captures-ios` | 30 screenshots, six languages | 7 days, it is an intermediate |
| `captures-android` | the same, from the emulator | 7 days |
| `store-deck` | both composed decks, what a listing uploads | 90 days |

`HTN_WHAT=captures npm run deck:fetch` takes the raw captures instead, for
recomposing a deck locally after changing `shots.json`, which is the fast half
of the loop and needs no toolchain at all.

## Working on the captures without waiting for thirty of them

A full Android pass is six languages by five shots on an emulator this script
cold boots, which is not a thing to iterate on. Narrow it:

```sh
HTN_SERIAL=emulator-5554 HTN_LOCALES=en HTN_SHOTS=02-import \
  tools/marketing/capture-android.sh
```

`HTN_SERIAL` uses an emulator that is already running, which skips the boot.
`HTN_LOCALES` and `HTN_SHOTS` are space separated lists. A narrowed run does not
write the fingerprint, so it cannot claim the whole deck is current.

When the app misbehaves rather than the script, the only thing that says why:

```sh
adb logcat -c && adb logcat | grep -iE "hidethenotch|AndroidRuntime|ReactNative"
```

Leave it running in a second terminal and start the capture in the first. A
React Native crash prints a stack there and nowhere else: the script sees a
screenshot that never arrives and can only report the timeout.

The iOS side takes `HTN_LOCALES` the same way.

**`npm run marketing:serve` is where a deck is worked on.** `compose.cjs` produces one
complete HTML document per slot and only hands it to headless Chromium at the
end, so the workbench serves that same document instead of photographing it.
Edit a spec, the page reloads; press "Shoot this one" and the real headless
render appears in the frame beside the live one, in two seconds. The only
difference between the two is where the pictures come from, a URL or a data
URI, and that is one function in the compositor.

**The Android emulator is not any emulator.** The Play shots are drawn at 412 x
915 points at density 2.625, which is 1080 x 2400 pixels at 420 dpi: a Pixel 6,
and every Pixel since has the same screen. An
AVD with another density produces captures that do not line up with the phone
drawn around them. `npm run avd` creates exactly that one, named `htn-pixel`,
API 35, `google_apis`, arm64 on Apple Silicon and x86_64 elsewhere, and writes
the three numbers into its `config.ini` so a later edit in Android Studio cannot
quietly move them. It needs the SDK's command line tools, which Android Studio
does not install by default: SDK Manager > SDK Tools > Android SDK Command-line
Tools (latest). The system image is a 1.5 GB download, once.

API 33 is the floor whatever you pick: per app languages arrived in Android 13,
and the capture script sets the app's language rather than the phone's.

The profile is a Pixel 6, 7 or 8, whichever the SDK has: they are the phones
whose screen is exactly 1080 x 2400 at 420 dpi. A Pixel 9 or 10 is a different
screen (the 10 Pro is 1280 x 2856 at 480 dpi), so following it would mean moving
the deck's metrics and the wallpapers with it.

**The hole is put there, and it is a real one, and it is in the middle.** The
capture script turns on one of the AOSP overlays the "Display cutout" developer
option switches between, before it installs anything, so `DisplayCutout` reports
a punch hole, SystemUI lays the status bar out around it, and the app finds it
through the native module exactly as it would on a phone. It is turned off again
at the end of the run, and it fails the run rather than the deck if the system
image has no such overlay. `HTN_CUTOUT=0` for a real phone, which has its own.

Which overlay is not a detail, and the names are no guide: `hole` puts the
camera in the **top left corner**, not in the middle, so the app masked the
corner while the deck drew a hole in the centre of the same picture. The one to
ask for is `emu01`, measured at 479..601 x 0..132 on a 1080 wide screen, which
is centred and is what the Play deck is composed against. It is also what an API
35 image reports with every overlay off, so the AVD already has the right hole
and the script only asserts it. `capture-android.sh` lists the other four with
the rectangle each one produces.

**The emulator is cold booted, and that is not a detail.** A quick boot
snapshot restores SystemUI with everything else, including a status bar laid out
for the screen the AVD had when the snapshot was taken. Restored onto a screen
of another size, its content is composed for one height inside a window sized
for another, and the clock and the network icons come out sliced across the
middle of every screenshot. It survives reruns, it looks exactly like a bug in
the app, and it goes away the moment the emulator is restarted by hand.
`-no-snapshot` costs a minute per run and makes the whole thing impossible.
`probe-android.sh` takes the three screenshots that tell a system problem from
an app one, for the next time something in the chrome looks wrong.

The capture run addresses one device by serial, and prefers an emulator: a
phone plugged in for something else is still a device to adb and will otherwise
take the whole run. `HTN_AVD` names which AVD to boot, `HTN_SERIAL` names a
device to shoot on instead, a real phone included. Neither
script needs `adb` or `emulator` on your PATH, which is just as well because
Android Studio puts neither there: `tools/marketing/android-env.sh` finds the
SDK, and `ANDROID_HOME` overrules it.

**Xcode 27 used to produce a black screen**, and not because of anything here:
an app built against the iOS 27 SDK has to adopt the UIScene life cycle, and
neither Expo SDK 57 nor React Native 0.86 does
([expo/expo#46664](https://github.com/expo/expo/issues/46664)). The window never
joined a scene and nothing was drawn. `plugins/withUIScene.cjs` supplies the two
missing pieces, the manifest and the `SceneDelegate` it names, so both Xcodes
work. `HTN_XCODE=/Applications/Xcode_26.app` still points somewhere else if a
toolchain turns out to have another opinion.

Run twice in a row, the first two do almost nothing the second time: the native
project is only regenerated when the Expo config or the dependencies change, the
pods only when the Podfile does, and both toolchains keep their own caches. What
is left is the JS bundle and the link. `HTN_REBUILD=1` forces the full pass.

**Android needs a JDK 17 or 21, and it is now the one you choose.** It did not
use to be. `JAVA_HOME` decides the JVM Gradle runs in, but the daemon's JVM was
decided by `android/gradle/gradle-daemon-jvm.properties`, which the prebuild
writes asking for Java 25, and Gradle provisions one into `~/.gradle/jdks` when
the machine has none. AGP then runs the prefab CLI with that same JVM, prefab on
24 and later writes the JEP 472 integrity warning into its own output, exits 0,
and AGP reads that output line by line and throws on the first line it does not
recognise. So three modules failed to configure, each reporting `WARNING: A
restricted method in java.lang.System has been called`, which is a warning about
nothing and not the error. `plugins/withGradleDaemonJvm.cjs` deletes that file
at prebuild time, here and under `npx expo run:android` alike, leaving one JVM
in the build: the one `JAVA_HOME` names. `brew install --cask temurin@21` is
enough to have one, any vendor will do, and `HTN_JAVA_HOME` points somewhere
specific. Both workflows pin 17.

The capture runs need Xcode and Android Studio respectively; the deck needs
neither. So the deck can be recomposed, retimed, recoloured and relocalised on
any machine that has the captures, but taking them again means the toolchain.

The captures themselves are not committed. They are output, a hundred and fifty
megabytes of it, and a run against a changed interface replaces every file:
committing them wrote that weight into the history once per run, for good.
`npm run deck` fails with the command to run when they are not there, which is
the only reason anyone wanted them in the tree.

That trade has one failure mode: shipping a deck of an app that no longer looks
like it. So a capture run stamps a fingerprint of everything that decides what
a screenshot contains, and `npm run deck` says so when the two have drifted
apart. Vigilance is a bad thing to ask of a person twice a year. `.github/workflows/store-captures.yml` runs all three on GitHub, so a
Mac is convenient rather than required.

Every run captures all six languages, one directory each under
`captures/<platform>/`, because a store listing wants a deck per locale and the
only thing that changes between them is what the app says.

The Android status bar is set by six demo mode commands, found by trying them on
a live emulator rather than derived from how demo mode ought to work. Two facts
took several passes to see, and between them they explain why this kept being
decided both ways:

`enter` does not reset a session already in demo mode, and a `network` command
sent into a live one **adds** a glyph rather than replacing it. That is the
second wifi, and it is why the script exits, waits a second for the exit to
land, and only then enters and sends `network` once. `exit` is a broadcast, so
an `enter` in the same breath is not an entry at all. Testing a command by
firing it at a bar that is already up gives the duplicate and the wrong
conclusion.

`enter` alone does not hold. The demo network state does not survive a SystemUI
restart, and enabling the cutout overlay causes one. With no wifi icon left,
Android 15 waits about ten seconds and then draws a **satellite**, its way of
writing "no service". Anything that looked at the bar a second after the
broadcast saw a clean bar and shipped it. Wifi shown and mobile hidden, asserted
once after `enter`, comes back through the restart intact.

`npm run demo:android` puts a running emulator into exactly that state, hole and
bar, without a capture run around it, and `tools/marketing/demo-android.sh off`
takes it back out. Looking at the app on an emulator dressed like the deck is
how most of the drawing bugs are found, and rerunning six languages to get there
costs twenty minutes.

iOS resolves the language from `NSUserDefaults`, and a launch argument of the
form `-Key value` lands there for that launch alone, so nothing device wide is
touched and nothing has to be put back. Android has carried a per app language
since 13, which is the same idea by a different name. Either way the phone stays
in whatever language it was in.

```sh
HTN_LOCALES="fr ja" npm run captures:ios      # while iterating
```

In the deck, `{lang}` in a capture path resolves to that locale's own language,
because the two are not spelled the same: the App Store says `fr-FR`, the app
says `fr`.

The app says when a shot is on screen, and it now waits for the shot rather
than for itself: a photo is not on screen until it has decoded, and a sheet is
not up until it has finished coming up. That is what the black screenshots and
the half raised sheets were, a script counting instead of asking.

It says it twice, because the two runs can hear different things. iOS reads a
file out of the app's container, which is the only channel `simctl` has.
Android reads the log for `HTN-READY <id>`, which is the only one `adb` has
against a release build: nothing in the app's own container can be read from
outside it without `run-as`, and `run-as` needs a debuggable build.

Two knobs if a machine misbehaves: `HTN_TIMEOUT` is how long to wait for that
answer before shooting anyway, and `HTN_SETTLE` is how long to let the picture
sit afterwards.

```sh
HTN_SETTLE=2 HTN_TIMEOUT=60 npm run captures:ios
```

Drop a variable font at `marketing/fonts/InterVariable.woff2` and the deck
uses it. Without one it falls back to the system sans, which is enough to judge
a layout and not enough to ship.

The data and the code are in two places on purpose. `marketing/` holds what is
this app's own: the captures, the deck specs, and a font if you drop one in. `tools/marketing/` holds the scripts, which know
nothing about this app that the specs do not tell them. That split is what makes
the second half worth taking to another app, and it is the one
[`../../docs/2026-marketing-workbench.md`](../../docs/2026-marketing-workbench.md)
argues for.

```
marketing/
  captures/{ios,android}/<lang>/*.png   not committed, `npm run captures:*`
  shots.json  shots-play.json           the deck, per store
  fonts/InterVariable.woff2             optional, and not committed
tools/marketing/
  *.cjs  *.sh                           the pipeline
```

Output goes to `renders/marketing/`, which is git ignored.

**The photograph is the author's own.** `assets/demo-photo.jpg` is a picture of
my cat, taken by me. It ships inside the app, because that is the only way both
platforms can be sure to find it (see `shotPhoto` in `App.tsx`), and it is what
the shots marked `photo: true` put under the mask: the deck has to show the app
doing the one thing a gradient cannot show, holding a real photograph. A store
listing may only show pictures its publisher has the right to show, so nobody
has to be credited and nothing has to be licensed here, which is the whole
reason to use one's own photograph rather than a stock one. A replacement has to
be as unencumbered as this one.

| File | What it does |
| ---- | ------------ |
| `compose.cjs` | one HTML page per shot, rendered by headless Chromium at store pixels |
| `serve.cjs` | the same pages, served, with a shoot button |
| `shoot.sh` | one screenshot that is neither black nor mid animation |
| `shots.json` | the deck as data: layout, copy and badges, per locale |
| `build-ios-sim.sh` | prebuild, pods and xcodebuild, unsigned, JS bundled in |
| `build-android.sh` | prebuild and Gradle, with the lintVital exclusion |
| `create-avd.sh` | the one emulator whose screen matches the Play deck |
| `probe-android.sh` | is the status bar the app's doing or the system's |
| `android-env.sh` | finds the SDK, since Android Studio puts nothing on PATH |
| `stamp.sh` | skips a step whose inputs have not moved |
| `capture-*.sh` | walks the app through `src/demo/shots.ts` and photographs it |
| `fingerprint.cjs` | says when the interface has moved since the captures did |

Layouts: `full` (the capture, edge to edge), `flat` (a drawn phone, straight
on), `tilt` and `tilt-right` (the same phone under a CSS 3D perspective). A shot
with two `screens` and a `wipe` gives the before and after split.

**Every picture in the deck is a screenshot of the app.** There are no rendered
stand ins left: the before and after comparison, which used to be two offscreen
wallpapers pasted together, is drawn by the app itself under a `compare` flag,
so the split carries the real glass, the real status bar and the real icons. A
missing capture is an error rather than a fallback, because a deck built out of
things nobody photographed looks finished and is a lie.

That is also what makes the pipeline portable: nothing here reaches into
`src/` any more.

`CHROME_PATH` overrides the browser lookup.
