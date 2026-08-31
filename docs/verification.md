# Checking the rendering without a device

The rendering code (`src/render/draw.ts`, shader included) runs out of the app,
against CanvasKit, the WebAssembly build of Skia already shipped as a dependency
of `@shopify/react-native-skia`. Nothing is reimplemented: the modules are
transpiled as they are, and only the `@shopify/react-native-skia` import is
swapped for its web implementation.

`tsconfig.harness.json` says which modules those are, and it says it as a
property of the tree rather than as a list of files: `src/render`,
`src/geometry`, `src/recipe` and `src/demo` are pixels and data, everything
named `useSomething` is a React hook and belongs to the app, and `export.ts` is
the one file in there that talks to the photo library instead of a canvas.

TypeScript will not enforce any of that, so `tools/harness-check.cjs` reads the
emitted JavaScript back and fails on anything it requires that Node could not
resolve. The day a drawing module reaches for `react-native`, the build says so
by name rather than a verification run dying halfway through.

```sh
npm run verify    # pixel checks
npm run samples   # writes native resolution PNGs into renders/
```

## What `verify` checks

**1. Cutout coverage.** For 3 families across 2 geometries, every pixel of the
cutout box must be exactly `0,0,0`. This is the property the whole app rests on:
on OLED, only absolute black merges with the panel.

**2. The bar corner turns the right way.** A plain rounded rectangle curves its
bottom corners upward, so the black stops *higher* at the screen edges than in
the middle, and the bar reads as a card laid on the wallpaper. It has to do the
opposite. Sampling one point on each side of the bar line settles the direction
without the test needing to know the radius: just below the bar line the edge
must still be black while the middle is not.

**3. No ugly position on the stripes slider.** Band height and decay used to be
two free settings, and most of that square was bad. One value now drives both,
so the check walks the whole travel and asserts, at each end and in the middle,
that the first band stays thick enough to read as a band and that the black
never covers more than 70 percent of the run, which is where the pattern stops
being a pattern and becomes the solid bar with extra steps.

**4. Fade dithering.** Two measurements, because the obvious one is misleading:

- *the noise reaches the output*, measured as the share of horizontally adjacent
  pixel pairs that differ. Without dithering it would be zero; we expect more
  than 15 percent.
- *no step in the steep part*, measured as the longest vertical run of a
  constant value over the first 60 percent of the fade.

Measuring the longest flat run over the **whole** fade says nothing: near the end
the curve meets the source, its slope tends to zero, and a flat run there is
normal since there is no step to mask. That false positive is what suggested
banding on the first pass.
