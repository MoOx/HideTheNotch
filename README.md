# Hide The Notch

An Expo and Skia rewrite of the 2017 app (the original code stays in git
history). Three mask families so far: **solid bar**, **decaying stripes**,
**dithered fade**.

Expo SDK 57, React Native 0.86, React 19.2, `@shopify/react-native-skia` 2.6

---

## What changed from v1

The 2017 version photographed the React Native view tree with
`react-native-view-shot`: the source photo was shrunk to screen size **before**
being captured, so exports were capped at screen resolution. Here a **recipe** is
described as JSON and drawn by a single function, always in points; the preview
plays it at scale 1, the export applies `canvas.scale(density)` before calling
it.

```
src/recipe/types.ts     the recipe (source and mask), serialisable
src/render/draw.ts      drawRecipe(canvas, ctx), the single drawing path
src/render/export.ts    offscreen surface at native pixels, PNG, camera roll
```

Preview and export parity is therefore **structural** rather than watched: there
is only one path. A free consequence: nothing forces the target to be the phone
in your hand, hence the device picker in the save sheet.

## The two properties everything rests on

1. **Black under the cutout is absolute.** On OLED a black pixel is an off
   pixel, so it is optically identical to the panel around the camera.
   `#010101` shows in a dark room. Exports are PNG: JPEG produces block
   artefacts at the black to image boundary, which makes the cutout reappear.

2. **The fade is dithered, in the right place.** The shader does not composite
   translucent black over the source: it **takes the source as an input**
   (`uniform shader uSrc`) and computes the final colour. Dithering the alpha
   does not dither the output, because the noise is attenuated by the luminance
   of the source, the more so the darker it is, which is exactly where banding
   shows. So the noise is applied to the final colour, at plus or minus 1 LSB,
   with a triangular probability density, computed in output pixels. The fade
   itself is computed in linear light.

Both are checked on real pixels, see below.

## Geometry

Everything measurable is measured (window size, density, safe areas). Only the
cutout box is inferred, because iOS does not publish it:

| Top inset | Inferred cutout | Reliability |
| --------- | --------------- | ----------- |
| 59 pt or more | Dynamic Island, 125 x 37.33 pt at 11 pt from the edge | safe, the island is the same physical size from the 14 Pro to the 17 Pro Max |
| 40 to 55 pt | Notch, 209 x 30 pt flush with the edge | approximate, the 13 and 14 notch is narrower (161 pt) |
| under 40 pt | none | safe |

**On Android nothing is inferred**: `insets.top` there is the status bar height,
which has nothing to do with the cutout. The user picks the target by hand. The
proper fix is a small native module reading
`WindowInsets.getDisplayCutout().getBoundingRects()`, which gives the **exact**
rectangles, better than iOS where they have to be guessed.

---

## Development

```sh
npm install
npx expo start          # needs a development build, not Expo Go, see below
npm run typecheck
npm run verify          # pixel checks, no device needed
npm run samples         # writes native resolution PNGs into renders/
```

### Checking the rendering without a device

The rendering code runs out of the app, against CanvasKit (the Skia WASM build
shipped with `react-native-skia`), which produces real PNGs and allows pixel
level assertions. See [`docs/verification.md`](docs/verification.md). The two
checks:

- the cutout is covered by exact `0,0,0`, for 3 families across 2 geometries;
- the fade is dithered (share of neighbouring pixels that differ) with no flat
  run in its steep part.

---

## Building without EAS

The repository is public, so standard GitHub runners are free and unmetered,
**macOS included**. The EAS quotas (15 builds per OS per month on the free plan)
stop being a constraint: you can never use it at all.

| Workflow | Runner | Trigger | Result |
| -------- | ------ | ------- | ------ |
| `verify.yml` | ubuntu | every push | types, pixel checks, bundles, sample PNGs as an artifact |
| `build-android.yml` | ubuntu | manual or `[build-apk]` | installable APK, about 10 min |
| `build-ios-sim.yml` | macos | manual or `[build-ios]` | unsigned simulator `.app` |
| `ios-testflight.yml` | macos | manual, `v*` tag | signed build shipped to TestFlight, about 8 min |

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

Three secrets and one variable, under *Settings, Secrets and variables,
Actions*:

| Name | Tab | Content |
| ---- | --- | ------- |
| `CERTIFICATES_DEPLOY_KEY` | Secrets | read-only ed25519 deploy key on `MoOx/certificates` |
| `MATCH_PASSWORD` | Secrets | match passphrase |
| `SECRETS_PASSPHRASE` | Secrets | passphrase for the `secrets/` directory of the certificates repository |
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

### Two traps met along the way

**The Xcode version.** `setup-xcode` with `latest-stable` selects an Xcode whose
Swift compiler rejects `expo-modules-jsi`, a module of Expo itself: `type of
expression is ambiguous without a type annotation`. The workflow therefore uses
the image default Xcode. A step prints its version on every run, so it can be
pinned explicitly and the build does not drift when GitHub updates the image.

**iPad support.** The 2017 app is still published, and it was built for iPhone
and iPad. Apple refuses an update that drops support for a device (`90101`), so
`supportsTablet` has to stay `true` as long as this app record is being updated.
On an iPad the app detects no cutout, but the device picker still allows
generating a wallpaper for an iPhone.

### What EAS is still good for

Nothing for builds. `eas update` remains the shortest way to push a JS-only
change to an already installed build without rebuilding, and the free plan
(1,000 monthly active users) is far beyond any testing use.

### Why not Expo Go

Expo Go ships a fixed set of native modules. `@shopify/react-native-skia`,
`expo-glass-effect` and `expo-media-library` are not among them, so there is no
Expo Go QR code for this app. The replacement is a development build: your own
Expo Go, built once, in which JS then reloads normally.

---

## Testing the different cutouts

Two distinct things, and only one needs an emulator.

**Judging the rendering**: the target picker, in the save sheet, forces any
geometry on any hardware: Dynamic Island at 393, 402, 430 and 440, notch at 375,
390 and 428, Android punch hole centred or offset. No emulator needed.

**Validating detection**: this is where the Android emulator genuinely helps. On
API 28 and above:

> Developer options, Drawing, *Simulate a display with a cutout*
> Default, Corner, Double, Punch hole, Tall, Waterfall

On the command line the same variants are system overlays:

```sh
adb shell cmd overlay list | grep cutout      # exact names vary by version
adb shell cmd overlay enable com.android.internal.display.cutout.emulation.hole
```

More reliable than iOS, where the simulator only offers existing models. And
since Android exposes the exact cutout rectangles through `DisplayCutout`,
detection there will eventually be more accurate than on iPhone.

---

## Still to do

- Set the wallpaper in one gesture: App Intent and shortcut on iOS,
  `WallpaperManager.setBitmap()` on Android. Both need native code.
- Native Android module to read `DisplayCutout.getBoundingRects()`.
- Pinch to reframe the photo (the model already carries `dx`, `dy` and `zoom`,
  and the renderer honours them).
- Families 12 (generative), 08 (organic decor), 07 (hanging object) and 09
  (content camouflage), see
  [`docs/2026-feasibility-and-ui.md`](docs/2026-feasibility-and-ui.md).
