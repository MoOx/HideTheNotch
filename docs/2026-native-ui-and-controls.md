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

- [x] **T1. Add `@expo/ui`** and confirm it builds on both platforms.
- [x] **T2. Fix the bar corner.** Inverted fillet with two corner modules,
      radius derived from height. `verify` now checks the direction.
- [x] **T3. The main slider.** One component, volume shaped, used by all three
      families.
- [x] **T4. Retire the handles** and wire each family to the slider. Bar loses
      its radius control, fade loses `solidEnd`.
- [x] **T5. Stripes to lines only**, single density value, floors so no position
      is ugly. `verify` walks the whole travel.
- [x] **T6. Curve as a radio row** with drawn icons, bottom left.
- [x] **T7. The two corner buttons**, glass, icon only, and no toolbar.
- [x] **T8. Family dots** between the buttons, swipe unchanged.
- [x] **T9. Icon grid preview backdrop**, drawn, preview only.
- [x] **T10. Sheets to `BottomSheet` / `ModalBottomSheet`** with detents,
      replacing the hand built `Sheet`.

### Where the build differs from this plan

- **Icons come from `expo-symbols`, not `@expo/ui`'s `Icon`.** The latter wants
  a vector drawable per icon on Android; `expo-symbols` takes a name on both
  sides, SF Symbol or Material Symbol, with the font bundled rather than
  fetched. One icon system for the whole app, no assets.
- **The curve row is not a native segmented control.** `Picker` takes strings,
  and the three values are curves: a drawn ramp says in one look what "eased"
  and "S curve" only say to someone who already knows. The row keeps the shape
  both platforms use for a short exclusive choice, in glass.
- **Both corner buttons are plain glass**, with no filled variant. Two buttons
  in fixed corners need no hierarchy invented for them.

---

## 6. Second round, from the first build on a device

What the build showed, and what it changed.

### Two things were broken

- **Export threw.** `saveToLibraryAsync` is the deprecated API and announces
  itself in the thrown error rather than in a warning. Now `Asset.create`.
- **Import failed silently.** `useImage` resolves the path through Skia's URL
  loader and the hook swallows a rejection, so a photo that cannot be loaded
  gives no image and no message: the app looks like it ignored the tap. It now
  reads the file's bytes and decodes them, and says what went wrong. The picker
  is also launched after the sheet has closed rather than on top of it.

### The stripes, properly

The first version ran two independent geometric series, one shrinking the bands
and one growing the gaps. They drift apart: by the fifth band the period had
more than doubled while the band had halved, so the eye never found a rhythm,
and the tail was a scatter of hairlines that simply stopped.

It is now a **halftone ramp on one grid**:

| | |
| --- | --- |
| Grid | one geometric series, opening gently downward (1.09 per step) |
| Coverage | falls from 0.85 to 0 along that grid |
| Law | `(1 - i/n)^2.2`, because the eye integrates the bands spatially: mean luminance is `1 - coverage`, and lightness goes as luminance to the power 1/2.2. The same reasoning as the fade shader |
| Floors | no slit of wallpaper under 5 pt, no band under 1 pt |
| Density | means one thing: how fine the pattern is, 7 bands to 13 |

The starting coverage is capped **once**, from the first period, rather than per
band. Clamping each band lets the clamp bind on the first few, and since the
grid grows those come out thicker than the one above: the pattern swells before
it dissolves. `verify` now asserts the bands never thicken going down, and that
check caught exactly this the first time it ran.

### The rest

- The **bar** stops at an eighth of the screen, and its radius now opens up with
  the height towards the display's own corner radius instead of tightening.
- The **fade** is first in the order and defaults to the S curve.
- The **home screen sketch** is on press, not by default, cross fading with the
  interface.
- The **sheets** are a `FieldGroup`, which is a SwiftUI `Form` with real
  `Section`s, so the grouping and typography come from the platform instead of
  from a column of bare rows. Both have the title they were missing.
- The **gradients** are shown as thumbnails: the real drawing scaled down, mask
  included, from the one drawing path.
- The **export target picker** is gone. It changed the preview live for a choice
  with no visible meaning until export.

---

## 7. Family 08, decor

The first family that is a **drawing** rather than a shape derived from the
cutout. Three patterns, one density slider, and a seed: tapping the pattern you
are already on reshuffles it, which is where the randomness lives without
costing a button.

| Pattern | What it is |
| --- | --- |
| `rig` | a ceiling lamp, and a smaller one either side once there is room |
| `vine` | leaves along the top edge with strands hanging out of them |
| `garland` | a cable, a lantern where it hangs lowest, bulbs along the rest |

### The mistake this family nearly shipped with

The plan was a black plate in the exact shape of the cutout, drawn first, so
coverage was guaranteed and the drawing only had to be nice. That plate was the
cutout plus a point and a half.

It hides the hole and it draws the hole. Black exactly over the cutout means
there is no longer a luminance boundary anywhere near the camera, so the hole
itself is gone; but the black then **ends where the hole ends**, so the
wallpaper spends its effort reproducing the cutout's own outline, in black, at
full contrast. The other three families never meet this because their black
spans the screen: the only edge they share with the cutout is a straight
horizontal line, which is a line and not a silhouette.

Two things came out of it. The plate now stands off the cutout by 9 pt and
carries a 12 pt radius of its own, well under the island's 18.67, so what
reaches the glass is a plate that happens to contain a hole. And `verify` grew
the check that was missing: black over the cutout **inset** by 2 pt, and black
over the cutout **grown** by 8 pt, on the left and the right, for every family.
The first check alone passes a mask that is a picture of the cutout.

### Drawing notes

- The lamp is the plate, widened. Hanging a narrower shade under the plate was
  the obvious composition and it reads as a lamp that came with packaging: the
  plate shows above it as a box. The shade has to start at the plate's width,
  which means it meets the screen edge, which is what a ceiling light does.
- A shade's bottom rim is an ellipse seen from below, so the silhouette's lower
  edge dips in the middle. One control point, and the trapezoid becomes a lamp.
- The foliage is one path, not a row of leaves. Overlapping leaves leave slivers
  between them for the plate to show through; a single canopy whose lower edge
  is a run of lobes cannot. Lobes of uneven width with their points off centre,
  and controls placed far along in x and barely down in y so each lobe bellies
  out before it turns into its point. Controls halfway give straight lines, and
  straight lines with even spacing are a saw blade, which the eye names much
  faster than it names a leaf.
- Skia has no tapered stroke, so the hanging stems are outlines built by hand:
  walk the curve, step off along the normal by half the width there, come back
  down the other side. A stem at one width is a wire.

### Judging it

Off device, `tools/` renders the three patterns at three densities on both a
Dynamic Island and a notch. The contact sheet must draw **where the hole is**,
or the black plate and the black drawing merge and every composition looks
covered. Two rounds of this were spent fixing an ear on the notch that no user
could ever see, and one real error hid behind the same confusion.

---

## 8. The gradient, as points

The five presets were three stops down a linear gradient with a radial halo laid
over them. They are now the same colours placed as **points**, drawn by a shader
that lets each one pull its colour over the screen. Nothing about the presets is
lost, since a pair of points across the top is a band of that colour, and the
thing that matters is gained: the result is editable, with no second kind of
gradient to keep working and no import step between a preset and something the
user has moved.

### The weight

    w = exp(-d² · 6) / (d² + 0.004)

Two things at once, and it needs both.

| | |
| --- | --- |
| `1 / d²` | inverse distance weighting. It goes to infinity at the point, so the colour **at** a point is that point's colour. That is what makes dragging a handle mean something |
| `exp(-d² · 6)` | the fence. Inverse distance alone reaches the whole screen: every point pulls on every pixel, which gives creases where two influences trade places and colours washed toward the average everywhere else. By the far edge the Gaussian has fallen to a quarter of a percent, so a point governs its own region and lets go of the rest |

A plain Gaussian was the other candidate and is smoother than either. It was
rejected on one point: its colour at a point is a blend, so a point set to pure
red gives a pink handle, and a direct manipulation interface cannot be built on
a control that does not do what it says.

Mixed in linear light and dithered, for the same two reasons as the fade.

Each preset carries an eighth point that is not obvious: an anchor in the middle
under the halo, in the **mid** colour. Without it the two mid points sit out at
the edges, nothing holds the centre, and the halo runs the whole height of the
screen as a column of light. In the dark colour instead it reaches higher than
the dark at the corners and the bottom of the wallpaper becomes a plume.

### What it cost the harness

`verify` went from seconds to three minutes. CanvasKit rasterises a runtime
effect per pixel on the CPU, and the harness was rendering 850 points of screen
to inspect the first 60. It now renders only the part each check reads, with a
guard that fails loudly rather than quietly checking fewer rows the day a mask
grows past the surface. Back to about 48 seconds.

On the device this does not arise: the same loop is nothing to a GPU.

### The editor

The wallpaper is the control. There is no diagram of the gradient anywhere: the
handles sit on what they are changing, at the position they are changing, and
the screen redraws under the finger.

- **Reached from the wallpaper sheet**, under the gradients it follows on from.
- **Drag** to move, **tap** to select, **tap the wallpaper** to put the panel
  away. Without that last one, a point dragged to the bottom of the screen ends
  up under the panel that appeared because it was selected, with no way back.
- Points may go a little past the edge. A point just off screen pulls its colour
  in from beyond the frame, which is the difference between a corner that is
  coloured and a corner where something ends, and it is the first thing anyone
  tries.
- The dot is 30 across, the area that catches the finger is 48.
- **Colour is each platform's own answer.** iOS gets the system `ColorPicker`,
  whose panel has a spectrum, a grid, sliders and an eyedropper that lifts a
  colour off the wallpaper underneath. Android has nothing equivalent to
  present, so it gets hue, saturation and brightness on three Material sliders.
  They are separate files rather than one branch, because `@expo/ui/swift-ui`
  asks for its native view at import time and a `Platform.OS` check in the body
  would already be too late.
- **Only the page being looked at is drawn** while editing. A drag changes the
  source every frame, the source is what all four pager pages share, and left
  alone they each redrew a full screen of gradient per frame in order to sit
  still off screen, where the pager cannot go because its gesture is off.

### Parked, deliberately

- Home screen screenshot as preview backdrop, from section 2.
- The export target picker, to bring back once choosing another phone does
  something visible other than resizing the preview under your hands.
- A larger gradient gallery, closer to the way iOS presents wallpapers, if the
  thumbnails in the list turn out to be too small to judge.
- `expo-splash-screen` with the recovered logo. The asset is committed as
  `assets/splash-icon.png` but nothing references it yet, and adding the plugin
  is a dependency change worth doing on its own.
- Pinning the Xcode version in `ios-testflight.yml` once the recorded value is
  known.
- Dropping the `[build-apk]`, `[build-ios]` and `[testflight]` commit markers
  once this branch is on `main` and `workflow_dispatch` becomes reachable.
