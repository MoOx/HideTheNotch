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
| `assets/android-icon-background.png` | gradient and guides, 1024 |
| `assets/android-icon-foreground.png` | marks only, sized for the 66 percent adaptive safe zone |
| `assets/android-icon-monochrome.png` | same silhouette, for Android themed icons |
| `assets/splash-icon.png` | marks only, smaller |
| `assets/favicon.png` | 64 x 64 |

The two SVGs are the source. The PNGs are rasterised from them with headless
Chromium at the sizes above; any renderer that understands plain paths and a
linear gradient will do, there is nothing exotic in the files.

The marks occupy 76 percent of the icon height, centred. The 2017 icon let them
run slightly past the frame; centring them whole reads better at small sizes and
loses nothing.
