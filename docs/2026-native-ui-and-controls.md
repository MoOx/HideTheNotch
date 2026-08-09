# Native controls: plan and TODO

_August 2026. Written from a round of feedback on the first working build. It is
a work list, not a study: every point below is a change to make, and nothing
here is decided by me alone._

Two things do not move, whatever the interface becomes:

- black under the cutout stays absolute `#000000`, PNG export only;
- `src/render/draw.ts` remains the single drawing path for preview and export.

`npm run verify` guards both. Any control rework has to leave it green.

---

## 1. Why nothing feels native today

Every control is a `View` with a `borderRadius` and a `BlurView` behind it. It
looks like a web design of an iOS app. The parts that carry the feel of a
platform, the way a segmented control snaps, the way a slider grabs, the exact
glass a system toolbar uses, are not being drawn by the system, so they are all
slightly wrong at once.

The fix is not more styling. It is to stop drawing the controls ourselves.

### What Expo actually offers

`@expo/ui` (`~57.0.9`, bundled with SDK 57) renders **real SwiftUI on iOS and
real Jetpack Compose on Android** from one React tree. Not a lookalike: the
actual platform component.

```ts
import { Host, Button, Picker, Slider } from "@expo/ui/swift-ui";
import { glassEffect, buttonStyle } from "@expo/ui/swift-ui/modifiers";
import { Button as MButton, FilterChip } from "@expo/ui/jetpack-compose";
```

Everything must sit under a `<Host>`, which is the bridge container.

`expo-glass-effect` is already a dependency and gives `GlassView`, a real
`UIVisualEffectView`, for surfaces that are not `@expo/ui` components.
`expo-symbols` gives SF Symbols. `expo-haptics` is already wired.

### One design, two materials

The user says "liquid glass"; on Android that means Material 3. Same component
in the tree, different platform module.

| Element | iOS 26+ | iOS < 26 | Android |
| ------- | ------- | -------- | ------- |
| Corner buttons | `Button` + `buttonStyle: "glass"` | `Button` + `bordered`, `expo-blur` behind | Material 3 `IconButton`, tonal |
| Toolbar surface | `GlassEffectContainer`, `glassEffect` modifier | `expo-blur` `BlurView` | `HorizontalFloatingToolbar` |
| Three way choice | `Picker`, `pickerStyle: "segmented"` | same | `FilterChip` row, single choice |
| Main slider | custom, see section 3 | same | same, Material radii |
| Sheets | `BottomSheet` + `presentationDetents` | same | `ModalBottomSheet` |
| Feedback | `expo-haptics` selection | same | same |

`isLiquidGlassAvailable()` picks the first two columns. Below iOS 26 the glass
degrades to a blur, which is what the system itself does.

---

## 2. The screen, redrawn

Bottom up, over a full screen wallpaper:

```
              . . o .            <- family dots, floating, above everything
  [ photo ]              [ save ]   <- two glass buttons, in the two corners
                        (  slider )  <- main control, bottom right, thick
```

Three changes from today:

1. **The family indicator leaves the toolbar.** It becomes a row of dots just
   above the buttons, read like the home screen page dots: position, not a
   label. Swiping still changes family; the dots only say where you are.
2. **The toolbar disappears.** Two buttons remain, one in each bottom corner:
   a picture icon on the left for the source, a save button on the right. Both
   glass. Nothing between them.
3. **The main setting becomes one large slider**, bottom right, shaped like the
   iOS volume control: a wide rounded track that fills, not a thin line with a
   knob. It is reachable with the thumb, and it never covers the top of the
   wallpaper, which is the part being judged.

### Handles go away

Every family currently exposes its main setting as a handle dragged near the top
of the screen. That is the worst place on a phone to put a control, and it sits
exactly over the area the user is trying to look at. The handles are replaced by
the bottom right slider. Direct manipulation stays available for the fade's
secondary boundary only if it earns its place after the slider exists.

### The preview background

A gradient tells you nothing about whether the mask works. Real home screens
have icons under the cutout.

- **Now**: a grid of dumb app icons, drawn, no branding, over the source. It
  makes the top of the screen legible as a home screen and shows immediately
  whether the black bar reads as hardware.
- **Later, noted so it is not lost**: let the user hand in a screenshot of
  their own home screen and use it as the preview backdrop. Same recipe, real
  icons, real spacing. This is a preview feature only, it never enters the
  exported wallpaper.

---

## 3. The main slider

One control per family, always in the same place, always the same shape. The
family decides what it drives.

| Family | The slider drives | Secondary control |
| ------ | ----------------- | ----------------- |
| Bar | height, with the corner radius derived from it | none |
| Stripes | one "density" value driving period and decay together | none |
| Fade | end of the fade | curve, three choices, bottom left |

Shape: a rounded rectangle roughly 56 pt wide and 200 pt tall, glass, filling
from the bottom, dragged anywhere on its body rather than on a knob. Haptic tick
at the hard stops. No number displayed.

---

## 4. Per family work

### 4.1 Bar

- **One control instead of two.** Height is the only thing the user sets. The
  radius is a function of the height: it starts matched to the island radius and
  **decreases slightly** as the bar grows, never increases.
- **The corner is inverted, and today it is wrong.** `drawBar` in
  `src/render/draw.ts:137` draws a plain rounded rectangle, so the bottom
  corners curve upward toward the screen edges. The bar has to meet the edge the
  way the notch itself does: a concave fillet, the black running further down at
  the sides and curving inward to the bar line.
  Concretely, a filled rectangle plus a **corner module in each bottom corner**,
  each module being a square minus a quarter disc. That is the reading of "two
  modules in the corners"; if it meant something else, this is the point to
  correct before the work starts.
- Result: `radius` leaves `BarMask` as a user setting and becomes derived.

### 4.2 Stripes

- **Lines only.** `grid` and `dots` are dropped. They are ugly and they add a
  choice that has no good answer.
- **One control instead of two.** `period` and `decay` are driven together by a
  single value. The pairing is chosen so no position of the slider is ugly.
- **Two failures to design out, not to expose:**
  - when the second band, the one just under the cutout, gets too small, the
    result falls apart. The pairing must keep that band above a floor.
  - past a certain decay the result is only large black bands, which is the
    solid bar with extra steps. The pairing must stop before that.
- The technical parameters stay in `StripesMask`, since the renderer needs
  them, but they stop being reachable from the interface.

### 4.3 Fade

- **The slider drives "end of fade"**, and that alone.
- **`solidEnd` stops being a control.** It is pinned just under the cutout,
  which is where it has to be anyway, and moves with the geometry.
- **Curve becomes three buttons with radio behaviour**, bottom left, with icons
  rather than the words linear, eased and S curve: a small curve drawn in each
  button says it in one look. This is the "what would be native here" question:
  a **segmented control** on iOS (`Picker`, `pickerStyle: "segmented"`), a
  **single choice chip row** on Android (`FilterChip`). Both are the platform's
  own answer for a small exclusive choice, and both are one line with
  `@expo/ui`.

---

## 5. TODO, in order

Each step leaves the app working and `npm run verify` green.

- [ ] **T1. Add `@expo/ui`**, wrap one control in `Host` as a spike, confirm it
      builds on both platforms in CI. Blocks everything else. ~0.5 d
- [ ] **T2. Fix the bar corner.** Inverted fillet with two corner modules,
      radius derived from height. Add a coverage case to `verify`. ~0.5 d
- [ ] **T3. The main slider.** One component, volume shaped, glass on iOS and
      Material on Android, used by all three families. ~1 d
- [ ] **T4. Retire the handles** and wire each family to the slider. Bar loses
      its radius control, fade loses `solidEnd`. ~0.5 d
- [ ] **T5. Stripes to lines only**, single density value, floors so no position
      is ugly. ~0.5 d
- [ ] **T6. Curve as a segmented control** with drawn icons, bottom left. ~0.5 d
- [ ] **T7. The two corner buttons**, glass, icon only, and remove the toolbar.
      ~0.5 d
- [ ] **T8. Family dots** above the buttons, swipe unchanged. ~0.25 d
- [ ] **T9. Icon grid preview backdrop**, drawn, preview only. ~0.5 d
- [ ] **T10. Sheets to `BottomSheet` / `ModalBottomSheet`** with detents,
      replacing the hand built `Sheet`. ~0.5 d

About 5 days. T1 to T4 already give the app its shape; the rest can land one
commit at a time.

### Parked, deliberately

- Home screen screenshot as preview backdrop, from section 2.
- `expo-splash-screen` with the recovered logo. The asset is committed as
  `assets/splash-icon.png` but nothing references it yet, and adding the plugin
  is a dependency change worth doing on its own.
- Pinning the Xcode version in `ios-testflight.yml` once the recorded value is
  known.
- Dropping the `[build-apk]`, `[build-ios]` and `[testflight]` commit markers
  once this branch is on `main` and `workflow_dispatch` becomes reachable.
