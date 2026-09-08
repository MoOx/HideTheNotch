# The icon, recovered from the 2017 design file

The 2017 app shipped a crossed pencil and paintbrush in white on a blue to
purple gradient. No rendered icon was ever committed: the only source was
`assets/design.sketch`, removed in `e5a125e` when the rewrite was promoted to
the root. It is still in git history:

```sh
git show e5a125e^:assets/design.sketch > design.sketch
unzip -q design.sketch -d sketch/
```

Everything below was extracted from that archive and rebuilt as vectors, so the
icon is now editable and reproducible without Sketch.

## What the file contained

Page `462A91A7-9989-443D-A0F1-079FBB5546EA.json`, symbol masters `logo`
(396 x 344) and `icon` (512 x 512).

| Ingredient | Value |
| ---------- | ----- |
| Background | linear gradient, `#5497D0` at stop 0.02 to `#6821AF` at stop 1, from `(0.151, 0)` to `(1, 1)` of the square |
| Guides | 2 diagonals, 5 vertical and 5 horizontal lines, 3 concentric rings |
| Guide colour | stroke `#F3EFEA` at 25 percent, inside a group at 33 percent, so 8.25 percent effective |
| Marks | 7 filled paths, white, `fill-rule: evenodd`, in two groups named `pencil` and `brush` |

## The one non obvious thing: Sketch rotations

Sketch stores `rotation` in degrees plus `isFlippedHorizontal` and
`isFlippedVertical`, all applied about the centre of the layer frame. Converting
naively gives a shape that looks plausible and is wrong: the first attempt came
out rotated by 180 degrees.

The rule that reproduces the file:

```
angle = isFlippedHorizontal != isFlippedVertical ? +rotation : -rotation
transform = translate(x, y)
            translate(w/2, h/2) rotate(angle) scale(sx, sy) translate(-w/2, -h/2)
```

The check that this is right, rather than merely close: with that rule the
reconstructed bounding box of the marks is `31.85, -58.92, 332.61 x 461.24`,
and Sketch's own recorded frame for that group is `31, -60, 334 x 463`. The
geometry is recovered, not eyeballed.

Note that the artwork overflows its 396 x 344 master, which is why a converter
that trusts the artboard bounds clips the pencil and the brush.

## What is committed

| File | Contents |
| ---- | -------- |
| `assets/logo.svg` | the 7 marks alone, white, on transparency |
| `assets/icon.svg` | the full composition: gradient, guides, marks |
| `assets/icon.png` | 1024 x 1024, full bleed (iOS masks the corners itself) |
| `assets/icon-dark.png`, `assets/icon-tinted.png` | the same drawing in the two other tones iOS 18 asks for |
| `assets/android-icon-background.png` | gradient and guides, on Android's 108 unit canvas |
| `assets/android-icon-foreground.png` | marks and band, on the same canvas |
| `assets/android-icon-monochrome.png` | the marks alone, what a themed icon is cut from |
| `assets/splash-icon.png` | the same layer again, for Android's system splash |
| `assets/play-icon.png` | 512, 32 bit, which is what Play checks |
| `assets/feature-graphic.png` | 1024 x 500, which Play will not publish a listing without |
| `assets/favicon.png` | 64 x 64 |

`assets/logo.svg` is the source of the marks. Everything else is composed by
`tools/brand.cjs` and rasterised with headless Chromium; there is nothing exotic
in the drawing, any renderer that understands plain paths and a linear gradient
would do.

The marks occupy 76 percent of the icon height, centred. The 2017 icon let them
run slightly past the frame; centring them whole reads better at small sizes and
loses nothing.

## One drawing, and how it is kept that way

The PNGs are committed because a build must not need a browser. That means the
tree carries a copy of the drawing, and a copy can fall behind: it did. The
Android layers were composed from their own recipe, marks on a gradient, and
never got the band that was added to the icon later. Every other surface showed
the current icon and the phones showed the 2017 one, for a year, with nothing
anywhere to say so.

Two things now make that impossible, and both are worth keeping in that order.

**One drawing.** `iconBody()` is the icon without its ground, and `adaptive()`
is the only thing that knows about Android: it places that same body on the 108
unit canvas, in the inner 72 the launcher is certain to show, at exactly the
proportions the icon has on iOS. There is no second recipe left to forget.

```
108 canvas   the file
 72 icon     what every mask keeps: the icon, unchanged
 18 margin   cropped or slid under by the launcher
```

Nothing new is invented in that margin, and nothing stops at the edge of the
visible square either, because a launcher can slide the layers apart and would
show the ends: the gradient runs on in the colour the ramp would have reached,
the guides keep going at the same spacing, the band runs off both sides at the
depth it has where the square cuts it.

The band is deliberately not in the monochrome layer. A themed icon is cut from
that layer's alpha and repainted in one colour of the system's choosing, so half
opaque black would come back as a solid slab of it with the marks lost inside.

**One check.** `npm run brand:check` redraws every surface in the table and
compares it to the file in the tree, fails on a PNG in `assets/` that nothing
draws, and fails on an image `app.json` points at that is not in the table. It
runs in CI on any change to `src/`, `tools/`, `assets/` or `app.json`, so
editing the recipe without regenerating fails the build, and so does dropping a
hand exported PNG into `assets/`. The fix is always `npm run brand`.

The comparison is not byte for byte: two Chromiums disagree along an antialiased
edge, and a check that cries wolf on a runner upgrade is a check that gets
switched off. A pixel counts as moved only when nothing within one pixel of it
matches, in either direction. On the drift this was written for, 29 percent of
the foreground layer had moved.
