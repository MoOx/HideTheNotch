# Seven families, one interface: feasibility and UI

_August 2026. Follow-up to
[`2026-notch-masking-research.md`](./2026-notch-masking-research.md)._

Families kept: **01** solid bar, **03** dithered fade, **07** hanging object,
**08** organic decor, **09** content camouflage, **11** decaying stripes,
**12** pure generative.

Version with mockups:
[`2026-feasibility-and-ui.html`](./2026-feasibility-and-ui.html).

---

## 1. The cost is in the foundations, not the families

Taken on their own, five of the seven families are one to three days of work.
What is expensive is **five shared pieces** written once. After that, adding a
family becomes an evening.

| Foundation | Contents | Required by | Effort |
| ---------- | -------- | ----------- | ------ |
| **A, geometry** | Device table plus runtime measurement of safe area and model. Exposes a `{x, y, w, h, shape}` box in points and pixels. | all 7 | about 3 d |
| **B, recipe and engine** | JSON describes the wallpaper; one engine renders it on screen _and_ offscreen at native pixels. Preview and export parity is non negotiable. | all 7 | about 4 d |
| **C, SkSL layer** | Three reusable shaders: dithering at plus or minus 1 LSB, fractal noise (fbm), gradient interpolation in linear light. | 03, 08, 09, 12 | about 3 d |
| **D, procedural rig** | Seeded PRNG plus a _coverage guarantee_: a black base derived from the cutout, laid under the decor. | 07, 08, 11, 12 | about 2 d |
| **E, image analysis** | Downsample to 96 x 208, `readPixels()`, summed area table, framing solver. | 09 only | about 3 d |

**Foundation E is the only single use one, and the riskiest.** That is the
clearest argument for keeping family 09 out of the first pass.

---

## 2. The seven families, scored

Four axes out of 5: **rendering** (drawing difficulty), **parameters** (number
and subtlety of the settings), **content** (art direction needed up front),
**risk** (what may not work). Estimates assume foundations A and B exist.

| # | Family | Rendering | Params | Content | Risk | Verdict | Effort |
| - | ------ | :-------: | :----: | :-----: | :--: | ------- | ------ |
| 01 | Solid bar | 1 | 1 | 1 | 1 | **Trivial** | about 0.5 d |
| 11 | Decaying stripes | 2 | 2 | 1 | 1 | **Low** | about 1 d |
| 03 | Dithered fade | 3 | 3 | 1 | 3 | **Medium** | about 2 d plus foundation C |
| 12 | Pure generative | 4 | 2 | 3 | 1 | **Medium** | about 3 d plus foundation D |
| 08 | Organic decor | 3 | 3 | 3 | 1 | **Medium** | about 3 d |
| 07 | Hanging object | 3 | 2 | 5 | 2 | **High, art cost** | about 2 d plus 0.5 d per object |
| 09 | Content camouflage | 4 | 3 | 2 | 5 | **High, product risk** | about 5 d plus foundation E |

### 01, solid bar: trivial

A Skia `Path` with two rounded bottom corners, filled with `#000`. The only real
trap is the **default height**: on a notch it equals the cutout height, on a
Dynamic Island you have to go down to the safe area, otherwise 22 pt of photo
stay stranded under the island. Default radius matched to the island's (about
18 pt), so the bar reads as an extension of the hardware.

**Parameters**: no slider for the height, you grab the bottom edge of the bar
and pull it. Three magnetic snap points with haptic feedback (_flush with the
cutout_, _bottom of the safe area_, _free_). A single slider for the radius.

### 03, dithered fade: medium

An SkSL shader of about fifteen lines: gradient computed analytically,
**interpolated in linear light** then re-encoded, since a fade to black
interpolated in sRGB dives too fast and shows. Dithering is added before 8 bit
quantisation: triangular noise of amplitude 1/255 derived from the fragment
coordinates; a safer alternative is a 64 x 64 blue noise tile added on top.

**Real risk**: validation can only happen by eye, on an OLED panel, at low
brightness, in a dark room. A simulator will tell you nothing.

**Parameters**: two handles dragged on the wallpaper, end of absolute black and
end of the fade. The first one **stops** at the bottom of the cutout with a
haptic notch. Curve as three chips (_linear_, _eased_, _S curve_) rather than a
bezier editor.

### 07, hanging object: high (art cost)

Each object is a **parametric template**, not a fixed drawing: an anchor from the
top edge, a body that stretches to contain the cutout box, decorative
appendages. The same periscope has to work on a 125 x 37 island and a 26 x 26
punch hole; an imported SVG does not stretch correctly, so the paths have to be
coded as a function of the box.

**The limiting factor is not technical, it is human**: every object needs a real
idea. Six good objects beat twenty mediocre ones, and they can be added after
launch.

**Parameters**: a horizontal gallery of objects applied live; a single slider
(size, meaning the margin between body and cutout); a mirror toggle for offset
cutouts. Decorative parts move under the finger, the covering part stays locked.

### 08, organic decor: medium

A carrier path (branch, cable, garland) crossing the screen, then elements
distributed along it with a **seeded** random generator: same seed, same result,
therefore shareable.

**The trick that removes all risk**: lay down a black base in the exact shape of
the cutout first, then scatter the foliage over it. Coverage is guaranteed by
construction, and the organic part only has to look good.

**Parameters**: six patterns as chips (_branch, birds, cable, drip, garland,
smoke_), a density slider, and **a shuffle button**: one control produces endless
results, and the user taps until they like it without understanding the system.

### 09, content camouflage: high (product risk)

- **Automatic placement**: redraw the photo at 96 x 208, read the pixels, build a
  summed area table, then test a few hundred framings scoring mean luminance
  _and_ standard deviation under the cutout. A few milliseconds.
- **Local darkening**: a plain fade to black leaves a blurry smudge. The right
  method lifts the black point locally, a curve rather than a layer, so the
  texture of the photo dies naturally.
- **Refinement**: the fade distance is modulated by local luminance. Where the
  photo is already dark the transition is short and invisible; where it is bright
  it stretches.
- **The uncomfortable truth**: the area under the cutout must end at exact
  `#000000`. No analysis changes that. The solver only makes that black core
  _small and surrounded by near black_.

**Parameters**: one button and an honest verdict. "Fit automatically" runs the
solver and reports _excellent_, _acceptable_, or _this photo does not suit_. On
failure the app itself offers family 03 as a fallback, on the same framing.

### 11, decaying stripes: low

A loop of rectangles for the lines; a shader for the dot variant, where the
radius decays with distance. **The geometry does not start at the top of the
screen, it starts at the cutout**: the first band is forced to contain it and
everything else follows, which leaves only two free parameters. No setting
produces a bad result.

**Parameters**: three types as chips (_lines, grid, dots_), two sliders (spacing,
falloff), six presets in direct reach.

### 12, pure generative: medium

An SkSL mesh gradient shader: bilinear blend of four to six colours, warped by
fractal noise. **Preferable to blurred radial gradients**, since a blur at
1290 x 2796 is expensive in memory while a shader costs nothing. The black well
is trivial here: we control the background, so no failure case exists. The real
work is choosing the **palettes**, which is taste, not code.

**Parameters**: this is the first launch screen. The app opens on a wallpaper
already generated and already valid: no empty screen, no permission prompt,
saveable in two taps. A row of palettes, a shuffle button, a grain slider. Every
result carries a seed and can be regenerated for another device, later, at any
resolution.

---

## 3. Build order

Not a ranking by importance: a dependency chain. Each step delivers a piece the
next one needs, and each step produces an app that works.

1. **01, solid bar**: proves foundations A and B end to end, on the family where
   any alignment error shows immediately. `+0.5 d`
2. **11, decaying stripes**: almost free once 01 is done. `+1 d`
3. **03, dithered fade**: forces foundation C to be written. Banding is settled
   here, once and for all. `+2 d and foundation C`
4. **12, pure generative**: reuses C, adds D. Delivers a first launch with no
   photo and no permission. `+3 d and foundation D`
5. **08, organic decor**: the rig already exists, only art direction remains.
   `+3 d`
6. **07, hanging object**: same rig, plus a drawing constraint. Can be added
   object by object after launch. `+2 d then 0.5 d per object`
7. **09, content camouflage**: foundation E, single use. Treat it as a separate
   project. `+5 d and foundation E`

**Natural cut after step 4**: foundations A to D, four robust families, none
depending on graphic work. That is a complete and honest app. Steps 5 to 7 are
what make it remarkable, and they can come later.

---

## 4. The interface: one screen, five gestures

The app has a single object, the wallpaper being edited, and a single output, an
image. Any added navigation would be decoration. Hence: **no tabs, no menu, no
account, one screen.** The wallpaper takes 100 percent of the surface, the
controls float over it in glass, and most of the adjusting happens by touching
the wallpaper directly.

The point that changes everything: the preview is not a mockup of a phone inside
a phone. It is the wallpaper, full screen, **under the device's real cutout**.
You judge the result by looking at it, not by imagining it.

### Gesture vocabulary

| Gesture | Effect |
| ------- | ------ |
| swipe left and right | change effect family, like a camera filter |
| pinch | reframe and reposition the photo |
| drag a handle | adjust the effect directly on the wallpaper |
| long press | hide the whole interface to judge |
| shake | contact support |

### Anatomy of the screen, bottom up

1. **Action bar** in glass: `Source`, effect name plus position dots, `Save`.
2. **Control strip**: the two or three controls of the current effect, always
   visible.
3. **The wallpaper**, full screen, with the direct manipulation handles on it.

### Save sheet

`Set as wallpaper` (primary, through an App Intent and Shortcut, avoiding the
iOS crop editor), `Save to Photos`, `Share`, and the **format**, the only place
where the question "for which phone?" actually arises, therefore the only place
where it is asked.

---

## 5. One rule: three controls at most

All live, all reversible, never showing a numeric value except where the number
means something. Whatever does not fit in three controls does not fit in the app.

| Family | Control 1 | Control 2 | Control 3 | Hard constraint |
| ------ | --------- | --------- | --------- | --------------- |
| **01** Bar | edge dragged by hand | radius | none | floor under the cutout |
| **03** Fade | "end of black" handle | "end of fade" handle | curve (3 choices) | handle 1 at or below the cutout |
| **07** Object | object gallery | size | mirror | body contains cutout plus margin |
| **08** Decor | pattern (6 choices) | density | shuffle | invisible coverage base |
| **09** Camouflage | fit automatically | extent | softness | core in absolute black |
| **11** Stripes | type (3 choices) | spacing | falloff | band 1 contains the cutout |
| **12** Generative | palette | shuffle | grain | none |

**Hard constraints are never error messages.** A handle reaching the bottom of
the cutout does not stop silently: it butts, vibrates lightly, and shows a line.
The user learns the physical rule by touching it, without being told.

---

## 6. What I would cut

- **The bundled wallpaper library.** v1 had one; it is heavy, it dates, and it
  raises rights questions. Family 12 replaces it with an endless generator that
  weighs nothing.
- **Any settings screen.** Export format goes in the save sheet, calibration
  triggers after the first export, nothing is left to configure.
- **The help screen.** Replaced by haptic stops and a single sentence in the
  export sheet, at the moment it is useful.
- **Family 09 in v1.** It is the finest promise and the only one that can fail on
  the user's photo. It deserves to arrive on its own, when it is genuinely good.
