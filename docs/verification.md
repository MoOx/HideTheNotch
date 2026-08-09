# Checking the rendering without a device

The rendering code (`src/render/draw.ts`, shader included) runs out of the app,
against CanvasKit, the WebAssembly build of Skia already shipped as a dependency
of `@shopify/react-native-skia`. Nothing is reimplemented: the modules are
transpiled as they are, and only the `@shopify/react-native-skia` import is
swapped for its web implementation.

```sh
npm run verify    # pixel checks
npm run samples   # writes native resolution PNGs into renders/
```

## What `verify` checks

**1. Cutout coverage.** For 3 families across 2 geometries, every pixel of the
cutout box must be exactly `0,0,0`. This is the property the whole app rests on:
on OLED, only absolute black merges with the panel.

**2. Fade dithering.** Two measurements, because the obvious one is misleading:

- *the noise reaches the output*, measured as the share of horizontally adjacent
  pixel pairs that differ. Without dithering it would be zero; we expect more
  than 15 percent.
- *no step in the steep part*, measured as the longest vertical run of a
  constant value over the first 60 percent of the fade.

Measuring the longest flat run over the **whole** fade says nothing: near the end
the curve meets the source, its slope tends to zero, and a flat run there is
normal since there is no step to mask. That false positive is what suggested
banding on the first pass.
