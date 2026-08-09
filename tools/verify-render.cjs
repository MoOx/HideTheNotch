/**
 * Checks, on real pixels, the two properties the whole app rests on:
 *
 *  1. The cutout is covered by ABSOLUTE black (0,0,0). An "almost black" shows
 *     on OLED in a dark room.
 *  2. The fade does not band: over an 8 bit ramp, a value must never stay
 *     constant across a long run of rows.
 */
const path = require("path");
const Module = require("module");

const APP = path.join(__dirname, "..");
const HARNESS = path.join(APP, ".harness");

const CanvasKitInit = require(path.join(APP, "node_modules/canvaskit-wasm/bin/canvaskit.js"));
const { JsiSkApi } = require(path.join(APP, "node_modules/@shopify/react-native-skia/lib/commonjs/skia/web"));

(async () => {
  const CanvasKit = await CanvasKitInit({
    locateFile: (f) => path.join(APP, "node_modules/canvaskit-wasm/bin", f),
  });
  const Skia = JsiSkApi(CanvasKit);
  const types = require(path.join(APP, "node_modules/@shopify/react-native-skia/lib/commonjs/skia/types"));
  const realLoad = Module._load;
  Module._load = function (request) {
    if (request === "@shopify/react-native-skia") return { ...types, Skia };
    return realLoad.apply(this, arguments);
  };
  global.__DEV__ = false;

  const {
    drawRecipe, barRadius, stripeBands, stripeHead, fadeSolidEnd,
  } = require(path.join(HARNESS, "render/draw.js"));
  const { defaultMask } = require(path.join(HARNESS, "recipe/defaults.js"));
  const { ISLAND, NOTCH_WIDE } = require(path.join(HARNESS, "geometry/devices.js"));

  const devices = {
    "Dynamic Island": {
      kind: "island", width: 393, height: 852, scale: 3, insetTop: 59, insetBottom: 34,
      label: "", estimated: false,
      cutout: { x: (393 - ISLAND.w) / 2, y: ISLAND.y, w: ISLAND.w, h: ISLAND.h, r: ISLAND.r },
    },
    Notch: {
      kind: "notch", width: 390, height: 844, scale: 3, insetTop: 47, insetBottom: 34,
      label: "", estimated: false,
      cutout: { x: (390 - NOTCH_WIDE.w) / 2, y: 0, w: NOTCH_WIDE.w, h: NOTCH_WIDE.h, r: NOTCH_WIDE.r },
    },
  };

  let failures = 0;

  function render(g, mask, palette) {
    const wPx = Math.round(g.width * g.scale);
    const hPx = Math.round(g.height * g.scale);
    const surface = Skia.Surface.Make(wPx, hPx);
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color("#000000"));
    canvas.scale(g.scale, g.scale);
    drawRecipe(canvas, {
      recipe: { source: { type: "gradient", preset: palette, seed: 1 }, mask },
      geometry: g, image: null,
    });
    surface.flush();
    const img = surface.makeImageSnapshot();
    const px = img.readPixels(0, 0, {
      width: wPx, height: hPx,
      colorType: types.ColorType.RGBA_8888,
      alphaType: types.AlphaType.Unpremul,
    });
    return { px, wPx, hPx };
  }

  // -- 1. Absolute black over the cutout -------------------------------------
  console.log("\n-- Cutout coverage (absolute black expected) --");
  for (const [devName, g] of Object.entries(devices)) {
    for (const family of ["bar", "stripes", "fade"]) {
      const { px, wPx } = render(g, defaultMask(family, g), "ember");
      const c = g.cutout;
      // The 2 pt margin avoids sampling the antialiased edge.
      const x0 = Math.ceil((c.x + 2) * g.scale);
      const x1 = Math.floor((c.x + c.w - 2) * g.scale);
      const y0 = Math.ceil((c.y + 2) * g.scale);
      const y1 = Math.floor((c.y + c.h - 2) * g.scale);

      let worst = 0;
      let bad = 0;
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          const i = (y * wPx + x) * 4;
          const v = Math.max(px[i], px[i + 1], px[i + 2]);
          if (v > worst) worst = v;
          if (v !== 0) bad += 1;
        }
      }
      const ok = worst === 0;
      if (!ok) failures += 1;
      console.log(
        `  ${ok ? "ok  " : "FAIL"} ${devName.padEnd(15)} ${family.padEnd(8)} ` +
          `max channel = ${worst}${bad ? `  (${bad} non black pixels)` : ""}`
      );
    }
  }

  // -- 2. The bar corner turns the right way ---------------------------------
  //
  // A plain rounded rectangle curves its bottom corners upward, so the black
  // stops *higher* at the screen edges than in the middle. The bar has to do the
  // opposite. Sampling one point on each side of the bar line settles it without
  // knowing the radius: just below the bar line the edge must still be black
  // while the middle is not, and just above it everything must be black.
  console.log("\n-- Inverted bar corner --");
  for (const [devName, g] of Object.entries(devices)) {
    const mask = defaultMask("bar", g);
    const { px, wPx } = render(g, mask, "ember");
    const isBlack = (xPt, yPt) => {
      const i = (Math.round(yPt * g.scale) * wPx + Math.round(xPt * g.scale)) * 4;
      return px[i] === 0 && px[i + 1] === 0 && px[i + 2] === 0;
    };
    const r = barRadius(mask.height, g);
    const below = mask.height + r * 0.4;
    const above = mask.height - 2;

    const edgeBelow = isBlack(1, below) && isBlack(g.width - 1, below);
    const middleBelow = isBlack(g.width / 2, below);
    const edgeAbove = isBlack(1, above) && isBlack(g.width - 1, above);

    const ok = r > 0 && edgeBelow && !middleBelow && edgeAbove;
    if (!ok) failures += 1;
    console.log(
      `  ${ok ? "ok  " : "FAIL"} ${devName.padEnd(15)} radius = ${r.toFixed(2)} pt  ` +
        `edge below the bar line ${edgeBelow ? "black" : "NOT black"}, ` +
        `middle ${middleBelow ? "BLACK" : "not black"}`
    );
  }

  // -- 3. No ugly position on the stripes slider -----------------------------
  //
  // The pattern is a halftone ramp on one grid, and what makes it read as one
  // are properties the eye notices immediately when they break: a slit of
  // wallpaper too thin to be intentional, a band too thin to be a band, a run
  // so black it is the solid bar again, or a band that gets *thicker* going
  // down, which reads as a mistake rather than as a dissolve. Every position of
  // the slider has to hold all four.
  console.log("\n-- Stripes, over the whole travel --");
  for (const [devName, g] of Object.entries(devices)) {
    for (const density of [0, 0.5, 1]) {
      const bands = stripeBands(density, g);
      const head = stripeHead(g);

      const firstGap = bands.length ? bands[0].y - head : 0;
      const thinnest = Math.min(...bands.map((b) => b.h));
      let monotonic = true;
      for (let i = 1; i < bands.length; i += 1) {
        if (bands[i].h > bands[i - 1].h + 0.01) monotonic = false;
      }
      const run = bands[bands.length - 1].y + bands[bands.length - 1].h - head;
      const cover = bands.reduce((a, b) => a + b.h, 0) / run;

      const ok =
        bands.length >= 6 && firstGap >= 4 && thinnest >= 1 && monotonic && cover < 0.7;
      if (!ok) failures += 1;
      console.log(
        `  ${ok ? "ok  " : "FAIL"} ${devName.padEnd(15)} density ${density.toFixed(1)}  ` +
          `${String(bands.length).padStart(2)} bands, first slit ${firstGap.toFixed(1)} pt, ` +
          `thinnest ${thinnest.toFixed(1)} pt, ${monotonic ? "dissolving" : "NOT dissolving"}, ` +
          `${(cover * 100).toFixed(0)} % black`
      );
    }
  }

  // -- 4. Fade dithering -----------------------------------------------------
  //
  // Measuring the longest vertical run of a constant value says nothing: at the
  // end of the fade the curve meets the source, its slope tends to zero, and a
  // flat run there is normal since there is no step to mask.
  //
  // What matters is elsewhere:
  //   a) the noise reaches the output (neighbouring pixels on the same row must
  //      differ; without dithering they would all be identical);
  //   b) no flat run in the *steep* part of the fade, where quantisation steps
  //      would be visible.
  console.log("\n-- Dithered fade --");
  const g = devices["Dynamic Island"];
  const solidEnd = fadeSolidEnd(g);
  const fadeEnd = 420;
  const { px, wPx } = render(g, { type: "fade", fadeEnd, curve: 0 }, "haze");
  const x = Math.floor(wPx / 2);

  let differing = 0;
  let pairs = 0;
  for (let y = Math.floor(120 * g.scale); y < Math.floor(380 * g.scale); y += 1) {
    for (let dx = 0; dx < 40; dx += 1) {
      const a = px[(y * wPx + x + dx) * 4 + 2];
      const b = px[(y * wPx + x + dx + 1) * 4 + 2];
      pairs += 1;
      if (a !== b) differing += 1;
    }
  }
  const activity = (100 * differing) / pairs;
  console.log(`  noise active on ${activity.toFixed(1)} % of horizontal pairs (0 % = no dithering)`);
  if (activity < 15) {
    console.log("  FAIL dithering missing or too weak");
    failures += 1;
  } else {
    console.log("  ok   dithering present");
  }

  // Steep part: the first 60 percent of the fade.
  const steepStart = Math.floor((solidEnd + 4) * g.scale);
  const steepEnd = Math.floor((solidEnd + 0.6 * (fadeEnd - solidEnd)) * g.scale);
  let run = 0;
  let longest = 0;
  let prev = -1;
  for (let y = steepStart; y < steepEnd; y += 1) {
    const v = px[(y * wPx + x) * 4 + 2];
    if (v === prev) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
      prev = v;
    }
  }
  console.log(`  longest flat run in the steep part: ${longest} rows`);
  if (longest > 16) {
    console.log("  FAIL visible step likely");
    failures += 1;
  } else {
    console.log("  ok   no significant step");
  }

  console.log(failures === 0 ? "\nAll green.\n" : `\n${failures} failure(s).\n`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
