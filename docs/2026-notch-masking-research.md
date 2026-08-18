# Hiding the notch, nine years on: research note

_August 2026. Groundwork for a possible rewrite of HideTheNotch._

Interactive version (previews of the 13 families, switchable between notch,
Dynamic Island and punch hole):
[`2026-notch-masking-study.html`](./2026-notch-masking-study.html).

---

## 1. What v1 did (2017)

789 lines. A full screen `ImageBackground`, PNGs laid over it at
`position: absolute; top: 0`, then `captureRef()` from _react-native-view-shot_
to photograph the view and push it into the camera roll. Four bitmap masks with
no parameters: `Rounded Notch`, `Rounded Slim Notch`, `Hard Notch`, `Hard Slim
Notch`.

It was the right answer at the time: exactly one device in the world had a
notch, and `src/platform.js` described it in eight lines
(`isIPhoneX = height === 812 && width === 375`).

**What aged well**

- The core intuition: on OLED, `#000000` placed next to a cutout makes it vanish.
- The product gesture: you do not install a theme, you **export an image** that
  the user applies.
- A catalogue of bundled backgrounds plus personal photo import, with author
  credit shown.

**The five ceilings**

1. **One known device.** Every new iPhone shifted the mask out of alignment.
2. **Bitmap masks.** No height, no radius, no colour to adjust.
3. **Export equals screenshot.** The source photo is shrunk to screen size
   _before_ capture; no reframing, no zoom (the `ScrollView` pinch is commented
   out in `App.js`).
4. **No Dynamic Island.** It did not exist yet.
5. **The last mile untreated.** Nothing stops iOS from re-zooming the wallpaper
   when it is applied, which breaks pixel alignment.

---

## 2. Why the trick works, and when it breaks

Every iPhone with a cutout is OLED: a black pixel is an _off_ pixel, optically
identical to the panel around the camera. Three non negotiable rules follow:

1. **Absolute black, not "almost black".** `#010101` shows on OLED in a dark
   room.
2. **PNG only.** JPEG produces block artefacts at the black to image boundary.
3. **Dithered gradients.** A fade to black in 8 bits bands visibly; it needs
   noise of plus or minus 1 LSB.

### Cutout geometry

| Generation | Screen (pt) | Cutout | Position | Top safe area |
| ---------- | ----------- | ------ | -------- | ------------- |
| Notch, iPhone X to 11 Pro | 375 x 812 @3x | about 209 x 30 pt | flush with the edge | 44 pt |
| Notch, iPhone 12 to 14 Plus | 390 x 844 @3x | about 209 x 32 pt | flush with the edge | 47 pt |
| Dynamic Island, 14 Pro to 17 | 393 x 852 @3x | about 125 x 37 pt | floating, about 11 pt down | 59 pt |
| Punch hole, iPhone 18 Pro (rumoured) | unknown | about 13.5 mm | offset to the left | unknown |

Apple does not publish exact cutout geometry, so these are orders of magnitude.
In practice the app has to **measure** the current device (safe area and model)
and keep a fallback table for generating a wallpaper aimed at _another_ phone.

The structural difference: the notch **touches the top edge** (a plain bar
removes it), the Dynamic Island **floats** (it opens up designs that were
impossible before, but a solid bar wastes more surface on it).

---

## 3. Thirteen masking families

Each family is a **generator**, a function that takes the cutout geometry and
returns a stack of layers, not an image.

| # | Family | Principle | Scope | Cost |
| - | ------ | --------- | ----- | ---- |
| 01 | **Solid bar** | Flat black down to below the cutout. Parameters: height, inner corner radius. | universal | trivial |
| 02 | **False bezel** | Bar plus bottom and side borders: the screen reads as a framed image. | universal | trivial |
| 03 | **Dithered fade** | Flat black over the cutout, then a fade into the photo. Needs noise of plus or minus 1 level. | universal | medium |
| 04 | **Dome** | The bar dips where the cutout is: you only lose what is necessary. | universal | low |
| 05 | **Extended pill** | A wider black pill centred on the cutout: it reads as a UI component. | island, punch | low |
| 06 | **Symmetric echo** | The cutout is duplicated at the bottom: two identical marks read as intent. | universal | low |
| 07 | **Hanging object** | Periscope, lampshade, gondola: a stem from the edge, a black body wrapping the cutout. | island, punch | drawing |
| 08 | **Organic decor** | Branch, foliage, flock of birds, paint drip. Procedural variation: every wallpaper differs. | universal | drawing, generative |
| 09 | **Content camouflage** | Luminance analysis, framing that brings the dark area under the cutout, local darkening of the delta. | universal | image processing |
| 10 | **Liquid Glass lens** | Dress the cutout as an iOS 26 component: blur, refraction, specular rim. | island, punch | shader |
| 11 | **Decaying stripes** | Black bands spreading apart downward; the cutout becomes a cell of the pattern. | universal | generative |
| 12 | **Pure generative** | Mesh gradient, fractal noise, black well. Zero assets, zero rights questions. | universal | generative |
| 13 | **Deliberate outline** | The opposite: a glowing rim underlines the cutout. Doubles the catalogue for free. | universal | trivial |

Seven of these thirteen are **impossible** on the 2017 architecture: they need
dithered gradients, blend modes, procedural noise, or an export above screen
resolution.

---

## 4. The pipeline it requires

The structural change fits in one sentence: **stop photographing a React Native
view.**

| Layer | Choice |
| ----- | ------ |
| **Model** | A **JSON recipe**, not an image: source (photo, gradient, procedural), transform (framing, zoom, rotation), stack of parameterised masks, target device geometry. Serialisable, therefore shareable and regenerable for another phone. |
| **Preview** | `@shopify/react-native-skia` draws the recipe at screen scale, with pinch and pan through Reanimated 4 and Gesture Handler. Gradients, fractal noise and custom shaders are native. |
| **Export** | `Skia.Surface.MakeOffscreen(1290, 2796)` replays the **same** recipe at the device's real resolution, then `makeImageSnapshot()`, `encodeToBytes(PNG)`, `expo-media-library`. Quality 1:1, independent of the preview screen. |
| **Shell** | Expo SDK 56 or later (New Architecture). `expo-glass-effect` for the real Liquid Glass toolbar (native UIVisualEffectView) on iOS 26 and above, `expo-blur` as a fallback below. `@expo/ui` for SwiftUI sheets, `expo-haptics` for snapping feedback. |
| **Android** | Same Skia engine, same recipes. And `WallpaperManager.setBitmap()` applies the wallpaper **directly**, with no gallery and no cropping: the main iOS obstacle does not exist. |

---

## 5. The real problem: applying the wallpaper

A pixel perfect mask is worthless if iOS shifts it while applying it. That is
where v1 stopped ("set it to _Still_ and align it at the bottom") and it is where
the difference between a toy and a tool is decided.

**What breaks alignment**

- **Perspective zoom.** iOS enlarges the wallpaper by about 4 percent for
  gyroscope parallax.
- **Spatial scenes (iOS 26).** Subject and background separated by depth, then
  parallax: misalignment guaranteed.
- **Depth effect** on the lock screen.
- **The crop editor** that opens on every "Choose a photo" and invites pinching.

**The countermeasures**

1. **Export at the exact native resolution.** iOS then shows the image 1:1 by
   default.
2. **An App Intent plus a supplied Shortcut.** The Shortcuts _Set Wallpaper_
   action applies the image without opening the editor. One gesture. **To be
   validated in real conditions**, but it is the project's strongest
   differentiator.
3. **A calibration target.** A test wallpaper letting the user measure and
   correct a residual offset, then remembered for every export.
4. **Instructions targeted per iOS version**, not a generic blurb.

---

## 6. Is it worth it?

**The calendar is on our side.** The iPhone 18 Pro is expected in September 2026
with a much smaller cutout and, according to leaks, _offset to the left_. A
centred black bar is absurd on an asymmetric cutout: the whole category becomes
an open design problem again.

**The competition is weak but entrenched.** The App Store is full of Dynamic
Island wallpaper galleries: subscriptions, ads, 90 percent of the content behind
a paywall, no notion of real geometry. None offers a _generator_: parameterised
recipe, native resolution export, your own photo. That is the opening, and it
matches what HideTheNotch already was in 2017.

**The question to settle first** is not "which framework" but **how many
families at launch**. Three done well (parametric bar, dithered fade,
generative) beat thirteen done roughly, and families 05 to 09, the ones that
need drawing, are what will get the app talked about.

---

## Sources

- [Expo GlassEffect](https://docs.expo.dev/versions/latest/sdk/glass-effect/),
  [Expo SDK 55](https://expo.dev/changelog/sdk-55),
  [Expo SDK 56](https://expo.dev/changelog/sdk-56)
- [React Native Skia offscreen canvas](https://shopify.github.io/react-native-skia/docs/canvas/offscreen),
  [shading language](https://shopify.github.io/react-native-skia/docs/shaders/overview/)
- [iOS 26 lock screen, MacRumors](https://www.macrumors.com/guide/ios-26-lock-screen/)
- [iPhone 18 Pro smaller Dynamic Island, AppleInsider](https://appleinsider.com/articles/26/02/24/iphone-18-pro-again-rumored-to-feature-a-smaller-redesigned-dynamic-island),
  [punch hole dimensions, GSMArena](https://m.gsmarena.com/iphone_18_pro_series_dynamic_island_cutout_dimensions_leaked-news-71222.php)
- [Notch Remover, App Store](https://apps.apple.com/us/app/notch-remover/id1277467873),
  [Notcho, The Next Web](https://thenextweb.com/news/this-wallpaper-app-makes-your-iphone-xs-notch-disappear)
- [Android WallpaperManager](https://developer.android.com/reference/android/app/WallpaperManager)
