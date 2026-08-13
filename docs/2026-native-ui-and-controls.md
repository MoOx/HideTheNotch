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

## 7. Family 08, decor: built, and taken back out

**This family is not in the app. It was written, judged, and removed.** The
section stays so nobody starts it again from the same place, and because one
thing that came out of it is still load bearing.

The idea was a shape hanging from the top edge that happens to cover the cutout,
rather than a band that admits to covering it. Three patterns, one density
slider, and a seed that reshuffled when you tapped the pattern you were already
on: `rig`, a ceiling lamp; `vine`, leaves along the top edge with strands
hanging out of them; `garland`, a cable with a lantern where it hangs lowest.

### Why it went

The drawings were not good enough. Not broken, not wrong: just not up to the
rest of the app. Every one of them was reworked more than once, and each rework
fixed the thing that had been named and left something else that had not. A
family whose whole content is how a drawing looks does not get to be
approximately good.

There is also a constraint that made it harder than it looked, and that anyone
picking this up again will meet on the second afternoon rather than the first:

**Whatever this family draws, it has to be at least as wide as the cutout plus a
margin, from the top edge down past the bottom of the cutout.** On a Dynamic
Island that is a shape 143 pt wide and 57 pt tall before the object starts. On a
notch it is 227 pt wide, more than half the screen. So the object cannot be a
small lamp hanging on a cord: the mass at the top is forced, and the only real
freedom is the shape of its lower edge. That is why the lamp had to *be* the
plate rather than hang under it, and why the foliage worked best as one canopy
with a leafy underside. It is not a limitation of the drawings, it is the shape
of the problem, and a fourth attempt would meet it too.

### The mistake it caught, which is worth keeping

The plan was a black plate in the exact shape of the cutout, drawn first, so
coverage was guaranteed and the drawing only had to be nice. That plate was the
cutout plus a point and a half.

It hides the hole and it draws the hole. Black exactly over the cutout means
there is no longer a luminance boundary anywhere near the camera, so the hole
itself is gone; but the black then **ends where the hole ends**, so the wallpaper
spends its effort reproducing the cutout's own outline, in black, at full
contrast. The other three families never meet this because their black spans the
screen: the only edge they share with the cutout is a straight horizontal line,
which is a line and not a silhouette.

`verify` grew the check that was missing and **keeps it**: black over the cutout
inset by 2 pt, and black over the cutout grown by 8 pt on the left and the
right, for every family. Coverage alone passes a mask that is a picture of the
cutout. Beside and not below, because how far under the cutout a full width
family stops is that family's own decision, and the bar's whole minimum is that
it may stop exactly on it.

### The other thing learned, about judging

The off device contact sheet has to **draw where the hole is**. Without that
marker the black plate and the black drawing merge into one silhouette, and
every composition looks covered. Two rounds went into fixing an ear on the notch
that no user could ever see, and a real error hid behind the same confusion for
as long.


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
- **A point is moved by dragging anywhere, not by dragging the point.** Tap one
  to pick it up, then drag any part of the wallpaper and it follows, one to one.
  Dragging the handle still works and is what most people reach for, but it
  cannot be the only way: a point parked under the home indicator or up by the
  status bar belongs to iOS while a finger is there, and the first swipe goes to
  the system rather than to the app. The first build had exactly that dead zone.
  With the whole screen acting as a trackpad for whichever point is held, where
  that point happens to sit stops being something anyone has to think about.
- **A long press on a point opens its own menu**, with the colour and Delete.
  The first build put those in a panel pinned along the bottom, which was both
  permanently in the way of the thing being judged and, for a point dragged low,
  sitting on top of the very handle that opened it.
- Points may go a little past the edge. A point just off screen pulls its colour
  in from beyond the frame, which is the difference between a corner that is
  coloured and a corner where something ends, and it is the first thing anyone
  tries.
- The dot is 30 across, the area that catches the finger is 48.
- **Colour is each platform's own answer.** iOS gets the system `ColorPicker`,
  whose panel has a spectrum, a grid, sliders and an eyedropper that lifts a
  colour off the wallpaper underneath. Android has nothing equivalent to
  present, so it gets hue, saturation and brightness on three Material sliders,
  folded behind one row so the menu still reads as a menu. They are separate
  files rather than one branch, because `@expo/ui/swift-ui` asks for its native
  view at import time and a `Platform.OS` check in the body would already be too
  late.
- **The background gesture has to be told what it may not have.** The handles,
  the menu and the bottom bar are drawn over a full screen gesture area, and a
  recogniser attached to a view underneath still sees touches that land on the
  views above it: React Native's press handling and this library's recognisers
  are two separate systems and neither cancels the other. Left alone, tapping
  Delete would also tap the wallpaper, and dragging a handle would run two pans
  over the same point. So the background asks whether the touch started on
  something else, exactly, from the handle positions it already has and from the
  two panels' measured boxes.
- **Only the page being looked at is drawn** while editing. A drag changes the
  source every frame, the source is what all the pager pages share, and left
  alone they each redrew a full screen of gradient per frame in order to sit
  still off screen, where the pager cannot go because its gesture is off.

---

## 9. How big is a button

The two corner buttons were 54 pt, went to 44, and are back at 54. Worth
writing down, because the reasoning that took them to 44 sounded right.

**44 x 44 pt is the minimum tappable area** in the Human Interface Guidelines.
It is a floor under every control, not the size of a button. Reading it as "the
system puts these at about 44 across" makes every prominent round button in the
app the smallest thing the guidelines permit, next to system controls that are
visibly larger: a `large` button configuration is 50 pt tall before any circular
padding, and the round glass controls in the Photos editor and over the camera
land in the low fifties.

So: 54, with a 24 pt glyph, a shade under half, which is the proportion the
system's own buttons use. Section 3 had already asked for a slider "roughly
56 pt wide" beside them, so the column agrees with itself again.

The curve picker's cells follow from the same number, minus the glass column's
own padding, so that the *outside* of that control is as wide as the slider.
Matching the cell to the button instead, which is what it did, made the column
eight points wider than the slider and left the right hand edge of the interface
out of true.

---

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
