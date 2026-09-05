# Hide The Notch

An Expo and Skia rewrite of the 2017 app (the original code stays in git
history). Three mask families so far: **solid bar**, **decaying stripes**,
**dithered fade**.

Expo SDK 57, React Native 0.86, React 19.2, `@shopify/react-native-skia` 2.6

---

## From a clone to production

The whole path, in the order it happens. Every line is explained further down;
this is the map.

```sh
git clone git@github.com:MoOx/HideTheNotch.git && cd HideTheNotch
npm install                   # deps, patches, and the git hooks
npm run ios                   # or android: a development build on the simulator
npm start                     # from then on, JavaScript reloads into it
```

Then, for a change:

```sh
npm run typecheck
npm run verify                # the two properties, on real pixels, no device
git commit && git push        # CI runs both again, plus the two bundles
```

Then, to ship it. v2 goes out from this machine, and the tag comes last: a tag
that starts a release assumes the release works, which is not yet known here.

```sh
npm run doctor                # what the lanes need, and what is actually set
# bump expo.version in app.json, write the release note in marketing/listing.json
npm run deck:fetch            # the screenshots, without which no listing uploads

npm run beta:ios              # build, sign, upload to TestFlight
npm run beta:android          # build, sign, upload to the Play internal track
# install both on a real phone and look at the top of the screen

npm run promote:ios           # attach the build, upload copy and screenshots
SUBMIT_FOR_REVIEW=1 npm run promote:ios       # and start the review
PLAY_ROLLOUT=0.1 npm run promote:android      # production, a tenth of users first

npm run release -- --push     # tag it, once it is out
```

The very first Android release has one more step, done once by hand in the Play
Console, and Play may want a closed test before it opens production at all. Both
are in the checklist.

Details, in order of when you need them: [what a release
needs](#what-a-release-needs) is the checklist to run through first, [putting v2
on sale](#putting-v2-on-sale-from-this-machine) explains each step above, and
[what the two stores disagree about](#what-the-two-stores-disagree-about) is why
iOS and Android are not symmetrical.

---

## The three properties everything rests on

1. **Preview and export are the same drawing.** A recipe is described as JSON
   and drawn by one function, always in points: the preview plays it at scale 1,
   the export applies `canvas.scale(density)` before calling it. Parity is
   therefore structural rather than watched, because there is only one path.

   ```
   src/recipe/types.ts     the recipe (source and mask), serialisable
   src/render/draw.ts      drawRecipe(canvas, ctx), the single drawing path
   src/render/export.ts    offscreen surface at native pixels, PNG, camera roll
   ```

   Never add a second path. An export that is not what was on screen is the one
   bug this app cannot ship.

2. **Black under the cutout is absolute.** On OLED a black pixel is an off
   pixel, so it is optically identical to the panel around the camera.
   `#010101` shows in a dark room. Exports are PNG: JPEG produces block
   artefacts at the black to image boundary, which makes the cutout reappear.

3. **The fade is dithered, in the right place.** The shader does not composite
   translucent black over the source: it **takes the source as an input**
   (`uniform shader uSrc`) and computes the final colour. Dithering the alpha
   does not dither the output, because the noise is attenuated by the luminance
   of the source, the more so the darker it is, which is exactly where banding
   shows. So the noise is applied to the final colour, at plus or minus 1 LSB,
   with a triangular probability density, computed in output pixels. The fade
   itself is computed in linear light.

The last two are checked on real pixels by `npm run verify`, see below. The
first one is not checked, it is enforced: there is one function, and both
callers call it.

## Geometry

The geometry the drawing is given is always the one the device reports. There is
no target picker and there is nothing to pick: a wallpaper is cut for the screen
it will be set on, and the one screen the app can measure is the one in your
hand.

Everything measurable is measured (window size, density, safe areas). The
cutout box is asked for in three layers, in this order:

| Layer | Where it comes from | What it gives |
| ----- | ------------------- | ------------- |
| Android | `DisplayCutout.getBoundingRectTop()`, through `modules/htn-cutout` | the exact rectangle, including where across the width the hole sits |
| iOS | the hardware identifier, against the table in `src/geometry/models.ts` | the exact box, and it is the only way to tell a 209 pt notch from a 161 pt one at the same 47 pt inset |
| both | the safe area | the bottom of the hole, always |

The third layer is not a fallback that might be wrong: **a cutout is inside the
safe area by construction**. Apple defines the safe area to clear the sensor
housing, which is why an island ends 10.7 pt above it and a notch 14 to 17.
Android's top inset is asked for as `statusBars | displayCutout |
navigationBars`, so it is the larger of the status bar and the hole, never the
smaller.

Since every mask this app draws is a full width band, only the *bottom* of the
hole has ever mattered to the black. That bottom is `maskFloor()`, every family
starts there, and how far down it goes depends on who answered:

| `cutoutFrom` | Floor | Slider stops at |
| ------------ | ----- | --------------- |
| `system` | the hole, exactly | the floor |
| `models` | the hole plus 2 pt of doubt | the hole minus 2 pt |
| `safeArea` | the safe area | four fifths of it |

The safe area is a fallback and not the rule. It is the only line that cannot
be wrong, but being generous by 10.7 pt on every island iPhone, and by a whole
status bar on Android, is a band nobody asked for on two platforms that can say
better.

The 2 pt of doubt is what a table entry is worth. It is exact in principle and
was half a point short the one time it met a real phone: a Dynamic Island whose
box ends at 48.3 pt still showed a pixel or two under a bar of exactly that
height.

**The slider goes below the floor on purpose**, and that is the measuring
instrument. No screenshot ever contains a cutout, since the hole is physical,
so the only way to find out where one really ends is to lower the black until
the edge appears and read the height off the caption above the slider, which is
printed in points to one decimal. A device that measured its own hole does not
get that travel: there is nothing to second guess, and the only thing it could
do is uncover the camera.

Android before 9 and Expo Go report nothing at all, which lands on the safe
area like any unknown phone.

---

## Development

```sh
npm install
npm run ios             # or android: builds and installs a development build
npm start               # after the first one, JavaScript reloads into it
npm run typecheck
npm run verify          # pixel checks, no device needed
npm run samples         # writes native resolution PNGs into renders/
```

Two toolchain versions are declared at the root, `.node-version` and
`.ruby-version`, and everything reads them: fnm and rbenv locally, and every
workflow through `node-version-file` and `ruby/setup-ruby`. They come from the
templates in `MoOx/certificates`, so bump them there. Ruby is only needed to
release, and `rbenv install` is how a machine catches up with a bump.

The whole path to a version on sale is at the top of this file, and
[Releasing](#releasing-in-detail) explains each step of it.

`npm install` applies `patches/`, through `patch-package` on `postinstall`, and
so does `npm ci` on CI. There is one patch: `@expo/ui`'s `BottomSheet` gains a
`contentModifiers` prop, because the padding it puts around a sheet's children
is otherwise unreachable on Android and Compose has no negative padding to undo
it with. It is additive and belongs upstream rather than here, which is the
first item in [`docs/2026-todo.md`](docs/2026-todo.md). A patch is pinned to the
version in its filename: bumping `@expo/ui` means regenerating it, and
`patch-package` says so loudly rather than failing quietly.

Patch JavaScript only, and not because it is tidier: `@expo/ui` ships its
Android half as a built `.aar` under `local-maven-repo`, which
`expo-module.config.json` names as the artifact, so the Kotlin sources beside it
are never compiled here and a patch to them is silently inert. Expect the same
of any Expo package that publishes a prebuilt artifact.

Metro also caches what it transformed out of `node_modules` and does not always
notice that a patch has rewritten it, so an import added by a patch can be
undefined on a tree whose file plainly has it. `npx expo start --clear` once
after pulling a change to `patches/`.

### Checking the rendering without a device

The rendering code runs out of the app, against CanvasKit (the Skia WASM build
shipped with `react-native-skia`), which produces real PNGs and allows pixel
level assertions. See [`docs/verification.md`](docs/verification.md). The two
checks:

- the cutout is covered by exact `0,0,0`, for 3 families across 2 geometries;
- the fade is dithered (share of neighbouring pixels that differ) with no flat
  run in its steep part.

---

## The workflows

Nothing is built on a service. The repository is public, so GitHub's runners are
free and unmetered, macOS included, and every build happens on one of them or on
your own machine. No account, no quota, no `eas.json`.

| Workflow | Runner | Trigger | Result |
| -------- | ------ | ------- | ------ |
| `verify.yml` | ubuntu | every push | types, pixel checks, bundles, sample PNGs as an artifact |
| `build-android.yml` | ubuntu | manual or `[build-apk]` | installable APK, about 10 min |
| `build-ios-sim.yml` | macos | manual or `[build-ios]` | unsigned simulator `.app` |
| `ios-testflight.yml` | macos | manual, `v*` tag, or `[testflight]` | signed build shipped to TestFlight, about 8 min |
| `android-play.yml` | ubuntu | manual, `v*` tag, or `[play]` | signed AAB on the Play internal track |
| `ios-appstore.yml` | ubuntu | manual, a form | promotes a TestFlight build to the App Store record |
| `android-production.yml` | ubuntu | manual, a form | promotes an internal build to production |
| `store-captures.yml` | macos and ubuntu | manual or `[captures]` | both stores' screenshots, as artefacts, about 45 min |

The `[testflight]` and `[play]` markers are the counterpart of a tag starting a
release: they let work builds stack up without any of them ever leaving a tag
behind. The last two workflows compile nothing, they only talk to App Store
Connect and to the Play API, which is what lets a release happen from a phone.

`workflow_dispatch` can only be triggered from the default branch, which is why
the build workflows also accept a commit message marker. Drop the markers once
this is on `main`.

### A note on local Android builds

The workflow passes `-x lintVitalRelease` to Gradle. AGP runs `lintVital` on
release builds, including inside dependency modules, and it fails on
`react-native-skia` and `expo-modules-core` for reasons unrelated to this app.
Turning it off through the DSL does not work: AGP reads `checkReleaseBuilds`
during its own configuration, before an Expo config plugin can write to it,
hence excluding the task rather than configuring it.

Locally you need the same flag:

```sh
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease -x lintVitalRelease
```

### iOS signed with your Apple account

The private `MoOx/certificates` repository holds all the signing material and
provides the templates. `.github/workflows/ios-testflight.yml`, `fastlane/*` and
`Gemfile` are copies of them, adapted on a single point: `APPLE_TEAM_ID` comes
from a repository variable rather than being hardcoded.

The app's own identity is not among them. The bundle identifier, the package
name and the version come from `app.json`, which is the file Expo generates both
native projects out of, so nothing repeats them in `.env` or in a workflow.
`APP_IDENTIFIER`, `ANDROID_PACKAGE_NAME` and `APP_VERSION` still override the
manifest one at a time, for a fork or a one off, and are otherwise left out.

What has to be given is what the manifest cannot know: who is signing, and with
what. Three secrets and one variable, under *Settings, Secrets and variables,
Actions*:

| Name | Tab | Content |
| ---- | --- | ------- |
| `CERTIFICATES_DEPLOY_KEY` | Secrets | read-only ed25519 deploy key on `MoOx/certificates` |
| `MATCH_PASSWORD` | Secrets | match passphrase |
| `SECRETS_PASSPHRASE` | Secrets | passphrase for the `secrets/` directory of the certificates repository |
| `SENTRY_AUTH_TOKEN` | Secrets | organisation token from sentry.io, Settings, Auth Tokens. Its one scope, `org:ci`, is not a choice and is the right one. Source map upload only: without it, builds pass and crash reports arrive minified |
| `APPLE_TEAM_ID` | Variables | developer.apple.com, Membership |

Creating the deploy key is covered in `docs/03-sharing-access.md` of the
certificates repository, the rest in `docs/04-consumer-projects.md`.

The `AppStore_io.moox.HideTheNotch` profile already exists there, so no `match`
bootstrap is needed.

What the `ios beta` lane does, in order: temporary keychain, clone of the
certificates repository, secrets decryption, App Store Connect API key, `match`
read-only, `expo prebuild --clean`, switch back to manual signing (the prebuild
just reset it to automatic), build number from TestFlight, archive, upload.
Decrypted secrets are wiped on the way out, on success and on failure alike.

### Shipping to Google Play

The mirror of the iOS lane: `fastlane android beta` builds an AAB and uploads it
to the internal track, `.github/workflows/android-play.yml` runs it on a commit
message carrying `[play]`. It is inert until three files exist in
`MoOx/certificates` under `secrets/android/`, and those are the only part that
cannot be automated from here.

| File | What it is |
| ---- | ---------- |
| `release.keystore` | the **upload** key, not the app signing key. Play App Signing holds that one, which is the point of opting into it: an upload key can be replaced, a signing key cannot |
| `keystore.properties` | `storePassword`, `keyAlias`, `keyPassword` |
| `play-service-account.json` | a Google Cloud service account, invited in Play Console under Users and permissions with "Release to testing tracks" |

In Play Console itself, once, by hand: create the app under
`io.moox.hidethenotch`, accept Play App Signing, upload one AAB (Google refuses
the API for a package that has never had a release), then the content rating
questionnaire, the Data safety form, the privacy policy URL, the target audience
and the ads declaration. None of those five are reachable through the API.

#### The one build that has to be uploaded by hand

`fastlane android bundle` builds the signed AAB and stops. It never calls Play,
which is the point: there is nothing there to ask yet, and the lane that ships
asks Play what the last version code was.

```sh
export SECRETS_PASSPHRASE=...        # same one the certificates repo uses
bundle exec fastlane android bundle  # ANDROID_VERSION_CODE=1 unless you say otherwise
```

It prints the path of the AAB, under `android/app/build/outputs/bundle/release/`.
Drag that into Play Console, Internal testing, Create new release. From then on
`fastlane android beta` does the whole thing, and the `[play]` marker in a commit
message runs it on CI.

#### Version codes, and the one that got away

A version code is spent for the **package**, forever, on whatever track it was
uploaded to and whether or not that release was ever published. `android beta`
therefore takes the highest code across `internal`, `alpha`, `beta` and
`production` and adds one. It used to ask the internal track alone, which is how
it asked for 1 on an app whose 1 had been uploaded by hand somewhere else, and
Play refused it after a four minute build.

```sh
npm run codes:android       # what Play holds, and what the next build would ask for
```

That lane calls Play and builds nothing, so it answers in seconds. When the
number it reports is still refused, the code was spent somewhere no track
reports it, such as a draft release that was later deleted or an internal app
sharing upload. `ANDROID_VERSION_CODE` overrules the lookup:

```sh
ANDROID_VERSION_CODE=2 npm run beta:android
```

**How the number reaches the build**, which took two refusals to get right.
`app.json` is static JSON, so it cannot hold a number that only Play knows, and
prebuild writes `versionCode 1` into `android/app/build.gradle` from the value
it does not find there. The lane used to correct that with
`-Pandroid.injected.version.code`, which on this toolchain does nothing at all:
gradle accepts the property, the merged manifest still says
`android:versionCode="1"`, and Play refuses the upload once the four minute
build is over.

So the lane asks Play **before** the prebuild, puts the answer in
`ANDROID_VERSION_CODE`, and `plugins/withVersionCode.cjs` writes it into the
config prebuild is about to render. `build_aab!` then reads the generated gradle
file back and stops the run when it does not say what was asked for, because the
whole cost of that bug was finding out late. Unset, the plugin changes nothing,
which is what `npx expo run:android` wants.

### The store listings

Both stores read a tree of small text files, and they agree on almost nothing:
different folder names, different locale codes, a different name for the
description, screenshots in a different place. `marketing/listing.json` holds
the copy once, in the six languages the deck already speaks, and
`npm run store:listing` writes both trees:

```sh
npm run deck        # the screenshots, from the captures
npm run store:listing     # the two metadata trees, from listing.json
```

The trees are not committed, `marketing/listing.json` is. The lanes that upload
a listing regenerate them first, so there is no second copy of six languages to
keep in step. The generator also enforces every store limit (30 characters for a
name, 80 for Play's short description, 100 for Apple's keywords, and so on) and
refuses to write anything if one is over, since finding out at upload time costs
a review queue.

**Three lanes upload a listing, and no others**: `ios metadata`, `ios release`
and `android release`. A work build never does, which matters more on Play than
on the App Store: there a listing belongs to the app rather than to a track, so
an internal build that carried the listing with it would rewrite the public page
every time somebody pushed a commit marked `[play]`.

`fastlane ios metadata` pushes the App Store listing without building anything,
which is what a correction to the copy actually needs.

| Asset | Where it comes from |
| ----- | ------------------- |
| Screenshots | `npm run deck`, into `marketing/renders/` |
| App Store icon, 1024, **no alpha channel** | `assets/icon.png`, plus `icon-dark.png` and `icon-tinted.png`. Apple takes them out of the binary rather than the listing, so nothing uploads them: they are the ones in the asset catalogue. iOS 18 derives the two it is not given, badly, which is why it is given them |
| Android adaptive icon, three layers | `android-icon-background.png`, `-foreground.png`, `-monochrome.png`. Not sizes: the launcher composes them, masks the result to whatever shape it uses, and moves them against each other when the icon is dragged. The monochrome one is what a themed icon is cut from |
| Play listing icon, **exactly 512, 32 bit** | `assets/play-icon.png`. Play checks both, which is why it is a second file and not the same one |
| Play feature graphic, 1024 x 500 | `assets/feature-graphic.png`. Play will not publish a listing without it |

All of them come out of `npm run brand`, and all of them are one drawing: the
same gradient, the same grid, the same band, the same marks. What differs is
never the design, it is what each platform composes it from (one flat square on
iOS, three layers on Android) and what each store checks (1024 with no alpha for
Apple, exactly 512 and 32 bit for Play).

Note that none of these are *sizes*. An old icon template hands you twenty
files because you used to export every density by hand; both toolchains
rasterise those now from the one drawing.

### Two traps met along the way

**The Xcode version.** `setup-xcode` with `latest-stable` selects an Xcode whose
Swift compiler rejects `expo-modules-jsi`, a module of Expo itself: `type of
expression is ambiguous without a type annotation`. The workflow therefore uses
the image default Xcode. A step prints its version on every run, so it can be
pinned explicitly and the build does not drift when GitHub updates the image.

**A repository asked the wrong question.** The Android build failed three times,
five minutes in each time, on
`Could not resolve org.bouncycastle:bcprov-jdk15to18:[1.81,1.82)` with a read
timeout against jitpack. The range is the whole problem: to pick the highest
version that fits, Gradle **lists** the versions in *every* declared repository
instead of stopping at the first that answers, and one of ours is jitpack, which
serves source built GitHub artefacts and nothing else.

`plugins/withJitpackScope.cjs` does two things, and the first attempt only did
the second. It **forces** `bcprov-jdk15to18:1.81`, which is inside the range
`bcutil` asks for, so there is no range left to search and a fixed version is
fetched straight from the repository that has it. And it puts a **content
filter** on jitpack, through `repositories.all` rather than by editing the one
declaration in `android/build.gradle`: Expo's own gradle plugin adds jitpack to
each module too, which is why filtering the root declaration alone changed
nothing at all.

**iPad support.** The 2017 app is still published, and it was built for iPhone
and iPad. Apple refuses an update that drops support for a device (`90101`), so
`supportsTablet` has to stay `true` as long as this app record is being updated.

An iPad has nothing to hide, and the app says so by doing the honest thing: it
detects no cutout, `kind` is `none`, the corner fillet is not drawn, and what
comes out is a gradient with a black band across the top. Less useful than on a
phone, which is the truth of the situation rather than a gap to be filled. It is
not worth a device picker: a wallpaper generated for a screen you are not
holding cannot be checked against the screen it is for, which is the one thing
this app is about.

### Why not Expo Go

Expo Go ships a fixed set of native modules. `@shopify/react-native-skia`,
`expo-glass-effect` and `expo-media-library` are not among them, so there is no
Expo Go QR code for this app. The replacement is a development build: your own
Expo Go, built once, in which JS then reloads normally.

---

## Testing the different cutouts

Two distinct things, and neither is done from inside the app.

**Judging the rendering**, without a device at all: `npm run verify` runs the
real drawing code against CanvasKit over four geometries and checks the pixels,
and `npm run samples` writes a PNG per family for each of them. Both are in CI,
and the images come back as an artefact.

**Validating detection**: this is where the Android emulator genuinely helps,
and it is what `npm run captures:android` drives for the Play deck. On API 28
and above:

> Developer options, Drawing, *Simulate a display with a cutout*
> Default, Corner, Double, Punch hole, Tall, Waterfall

On the command line the same variants are system overlays:

```sh
adb shell cmd overlay list | grep cutout      # exact names vary by version
adb shell cmd overlay enable com.android.internal.display.cutout.emulation.hole
```

More reliable than iOS, where the simulator only offers existing models. And
since Android exposes the exact cutout rectangles through `DisplayCutout`,
detection there is more accurate than on iPhone: the overlays above are a way
to check the native module against a shape you chose yourself.

---

## Releasing, in detail

The map is at the top of this file. This is each step of it, with what it needs
and why it is a step rather than something a script decides on its own.

### Two ways to reach the testers

From CI, with a marker in the commit message, which builds on a runner from a
clean checkout:

```sh
git commit -m "Fix the fade at the bottom edge [testflight] [play]"
git push
```

From this machine, which is what v2 is doing until the whole path has been
walked once:

```sh
npm run beta:ios            # builds, signs, uploads to TestFlight
npm run beta:android        # builds, signs, uploads to the internal track
```

Every command that reaches fastlane goes through `tools/fastlane.sh`, which
installs the gems the first time it is asked and then gets out of the way. They
land in `vendor/bundle`, inside the project, for the same reason `node_modules`
is: `rm -rf vendor` undoes it and nothing outside this directory changes. So a
fresh clone needs `npm install` and nothing else, even to ship.

### What a release needs

Everything below has to be true before a version can go out. Most of it is set
up once and then forgotten, which is exactly why it is worth listing: the things
that stop a release are the things nobody has looked at in a year.

**On this machine**

| What | How to tell |
| ---- | ----------- |
| Xcode, for the iOS build | `xcodebuild -version` |
| A JDK 17 or 21, for the Android build | `java -version`, and see the note on `JAVA_HOME` above |
| Node and Ruby at the declared versions | `node -v`, `ruby -v`, against `.node-version` and `.ruby-version` |
| The values the lanes read | `npm run doctor`, which names every one and which lane wants it |
| Read access to `MoOx/certificates` | the lanes clone it themselves, over ssh |

`npm run doctor` is the one to run first. It reads `.env.example`, which
declares every value and the lanes that need it, and reports what the process
can actually see. `MATCH_PASSWORD` and `SECRETS_PASSPHRASE` come from the
keychain here; `APPLE_TEAM_ID` has to be in `.env` or exported.

**In the two consoles**

| What | Where | Needed for |
| ---- | ----- | ---------- |
| The app record | App Store Connect. It exists: v1 is published | every iOS upload |
| The app record | Play Console, created by hand, Play App Signing accepted | every Android upload |
| One AAB uploaded by hand | Play Console, once, `npm run bundle:android` builds it | the API refuses a package that has never had a release |
| Content rating, Data safety, privacy policy URL, target audience, ads declaration | Play Console | Play will not publish without all five |
| App Privacy answers | `npm run privacy:ios`, from `fastlane/app_privacy_details.json` | Apple will not accept a submission without them |
| A privacy policy that answers | `moox.io/apps/hide-the-notch/privacy` | both stores check the URL |

**In the repository**

| What | How to tell |
| ---- | ----------- |
| A deck, composed and looked at | `marketing/renders/` is not empty, `npm run marketing:serve` shows it |
| Copy that fits every store limit | `npm run store:listing` refuses to write anything over |
| A release note nobody has read twice | `release` per locale in `marketing/listing.json` |
| `expo.version` bumped | `app.json` |

### Putting v2 on sale, from this machine

A tag that starts a release assumes the release works. That is a fair
assumption for the tenth one and a poor one for the first, where the iOS build
can fail, the Android build can fail, and the review can come back rejected. So
v2 goes out by hand, in the order below, and the tag is written at the end as a
record rather than at the start as a trigger.

**One, prove the code.** The same three the CI would run:

```sh
npm run lint && npm run typecheck && npm run verify
```

**Two, the pictures.** Only if the interface moved since the last deck. It needs
both toolchains, or the CI capture run, and it must be looked at:

```sh
npm run captures:ios && npm run captures:android && npm run deck
npm run marketing:serve     # or: npm run deck:fetch, for the CI-built deck
```

**Three, the builds, and try them.**

```sh
npm run beta:ios            # to TestFlight
npm run beta:android        # to the internal track
```

Then install both from TestFlight and from the Play internal link, on a real
phone, and look at the top of the screen. This is the step the whole app exists
for and the only one no automation can do.

**Four, iOS to the App Store.**

```sh
npm run promote:ios                          # attaches the build, uploads copy and deck
SUBMIT_FOR_REVIEW=1 npm run promote:ios      # and starts the review
```

The first form is safe to run as often as you like: it prepares the version in
App Store Connect and stops. The second starts a review that cannot be
withdrawn quietly. Even after the review passes, the version waits for a tap
before going on sale, because `automatic_release` is false.

**This is also the step that creates the version.** A build on TestFlight is a
build, not a version: nothing appears under Distribution in App Store Connect
until a version record exists, and uploading to TestFlight does not make one.
`promote:ios` passes the version number from `app.json`, and `deliver` creates
it when it is not there. `metadata:ios` deliberately passes no version, so it
writes onto whichever version is already open for editing, and on an app that
has none it retries for five minutes and gives up with `Cannot find edit app
store version`. First release: `promote:ios`, or create the version by hand in
App Store Connect, then `metadata:ios` works for every correction afterwards.

**Five, Android to production.**

```sh
PLAY_ROLLOUT=0.1 npm run promote:android     # a tenth of users first
npm run promote:android                      # or everyone at once
```

This promotes the artefact that is already on the internal track, so what
reaches production is the binary that was tested, and it carries the listing
with it. A partial rollout is worth it here: the crash reporting has never run
in the wild, and Play holds the rest until the rollout is finished by hand.

**Six, record it.**

```sh
npm run release -- --push
```

Pushing the tag re-runs both build workflows on the commit that shipped. That is
not waste during this phase, it is the point: the pipeline gets exercised
against a commit whose release is already done, so a failure costs nothing and
tells you what to fix before the next version depends on it. `npm run release`
without `--push` writes the tag and leaves it here, if you would rather not.

Once a release has gone through that way and CI has proved it can do the same,
the order flips: tag first, and let the workflows do steps three to five.

#### Does Android need testers before production?

Possibly, and it depends on the age of the developer account rather than on the
app. Google requires a **personal** developer account **created after 13
November 2023** to run a closed test with at least **12 testers opted in
continuously for 14 days** before production access is granted at all. Accounts
older than that date, and organisation accounts, are exempt.

Play Console says which case applies: if the requirement is on this account, the
Production track is disabled until it is met, and the dashboard shows the tester
count and the days elapsed. Worth looking before planning a release date, since
14 days is not something to discover on the day.

If it does apply, the internal track is not enough: it has to be a **closed**
test, and the 12 testers have to stay opted in for the whole fortnight. Nothing
in this repository changes for that, `npm run beta:android` already uploads
where a closed test reads from.

### The smallest useful change

Once the path above has been walked once and CI has been shown to do the same, a
patch that touches JavaScript and nothing else needs, in full:

```sh
# edit, then
npm run verify              # only if you touched the rendering
# bump expo.version in app.json, write the release note in marketing/listing.json
npm run release -- --push   # the tag builds and uploads both platforms
npm run promote:ios && npm run promote:android
```

No captures, no deck, no local build, no fastlane on your machine for the build
itself. The parts people reach for out of habit and that a patch does not need:
`npm run captures:*` (the interface did not change), `expo prebuild` (the
workflows do their own), and `npm run beta:*` (the tag already ran them).

Until then, the order in [Putting v2 on sale](#putting-v2-on-sale-from-this-machine)
holds: build here, look at it, ship it, tag afterwards.

### What the two stores disagree about

Worth knowing before wondering why a listing changed and the other did not.

**App Store metadata belongs to a version.** The description, the keywords, the
screenshots and the release notes are attached to 2.0.0, and changing them means
a version in preparation and another review. The one exception is the
promotional text, which can be changed on a live version.

**Play's listing belongs to the app.** Title, descriptions, screenshots and the
feature graphic are per locale and change live, without a release and without a
review of the binary. Only the changelog belongs to a version code.

So `npm run metadata:ios` exists, to correct copy or replace screenshots on the
version being prepared without building anything. It needs that version to
already be open for editing, which `promote:ios` or App Store Connect creates.

`npm run metadata:android` is the same idea, and on Play it is the easier of the
two: the listing belongs to the app, so it goes up on its own at any time, with
no binary, no version and no review. `promote:android` also carries it, but
waiting for a promotion to fix a description, or to answer a Play Console
complaining that the full description is missing, is a promotion made for the
wrong reason. The changelog is the one part left out of this lane, because it is
the one part that belongs to a version code.

## Still to do

[`docs/2026-todo.md`](docs/2026-todo.md), in the order it should be done, and it
is the only list. Nothing is kept here in parallel, because two lists means one
of them is out of date and neither says which.
