/**
 * Checks, on real pixels, the properties the whole app rests on:
 *
 *  1. The cutout is covered by ABSOLUTE black (0,0,0). An "almost black" shows
 *     on OLED in a dark room.
 *  2. The black stands off the cutout by a margin. Black that stops where the
 *     hole stops hides the hole and draws its outline in its place, which is
 *     the same wallpaper the app exists to replace.
 *  3. The fade does not band: over an 8 bit ramp, a value must never stay
 *     constant across a long run of rows.
 */
const path = require("path");
const Module = require("module");

const APP = path.join(__dirname, "..");
const HARNESS = path.join(APP, ".harness");

const CanvasKitInit = require(path.join(APP, "node_modules/canvaskit-wasm/bin/canvaskit.js"));
const { JsiSkApi } = require(
  path.join(APP, "node_modules/@shopify/react-native-skia/lib/commonjs/skia/web"),
);

(async () => {
  const CanvasKit = await CanvasKitInit({
    locateFile: (f) => path.join(APP, "node_modules/canvaskit-wasm/bin", f),
  });
  const Skia = JsiSkApi(CanvasKit);
  const types = require(
    path.join(APP, "node_modules/@shopify/react-native-skia/lib/commonjs/skia/types"),
  );
  const realLoad = Module._load;
  Module._load = function (request) {
    if (request === "@shopify/react-native-skia") return { ...types, Skia };
    return realLoad.apply(this, arguments);
  };
  global.__DEV__ = false;

  const { drawRecipe, barRadius, barMinHeight, stripeBands, stripeHead, fadeSolidEnd } = require(
    path.join(HARNESS, "render/draw.js"),
  );
  const { defaultMask } = require(path.join(HARNESS, "recipe/defaults.js"));
  const { ISLAND, NOTCH_WIDE, NOTCH_NARROW, cutoutFromRect, cutoutBottom, maskFloor } = require(
    path.join(HARNESS, "geometry/devices.js"),
  );
  const { cutoutForModel } = require(path.join(HARNESS, "geometry/models.js"));
  const { presetSource } = require(path.join(HARNESS, "render/palettes.js"));

  const devices = {
    "Dynamic Island": {
      kind: "island",
      width: 393,
      height: 852,
      scale: 3,
      insetTop: 59,
      insetBottom: 34,
      label: "",
      cutoutFrom: "models",
      cutout: { x: (393 - ISLAND.w) / 2, y: ISLAND.y, w: ISLAND.w, h: ISLAND.h, r: ISLAND.r },
    },
    Notch: {
      kind: "notch",
      width: 390,
      height: 844,
      scale: 3,
      insetTop: 47,
      insetBottom: 34,
      label: "",
      cutoutFrom: "models",
      cutout: {
        x: (390 - NOTCH_WIDE.w) / 2,
        y: 0,
        w: NOTCH_WIDE.w,
        h: NOTCH_WIDE.h,
        r: NOTCH_WIDE.r,
      },
    },
    /**
     * A Pixel sized punch hole, off centre, exactly as Android hands it over:
     * a rectangle in display pixels, run through the same conversion the app
     * uses. It is the one shape in this list that is not in the middle of the
     * screen, which is the whole reason the native module exists.
     */
    "Android, punch hole": {
      width: 412,
      height: 915,
      scale: 2.625,
      // The status bar is taller than the hole, which is the whole point of
      // asking the device rather than the safe area: 47 pt of inset around a
      // hole that ends at 46.5, and on a phone whose bar is 24 pt taller than
      // its hole the difference is a black band nobody asked for.
      insetTop: 47,
      insetBottom: 24,
      label: "",
      cutoutFrom: "system",
      ...cutoutFromRect({ x: 105, y: 34, w: 88, h: 88 }, 2.625),
    },
    /**
     * A phone the app has been told nothing about.
     *
     * Android reports no cutout before Android 9, and none at all in Expo Go,
     * so this is what an unrecognised device looks like from in here: an inset
     * and no hole. It is in this list because it is the case that used to fail
     * silently, drawing a one point band on a phone with a hole in it.
     */
    "Android, unknown": {
      kind: "none",
      width: 412,
      height: 915,
      scale: 2.625,
      insetTop: 32,
      insetBottom: 24,
      label: "",
      cutoutFrom: "safeArea",
      cutout: { x: 206, y: 0, w: 0, h: 0, r: 0 },
    },
  };

  let failures = 0;

  /** Everything but the fade check lives in the first points of the screen. */
  const TOP = 140;

  /**
   * Membership test for the cutout's rounded rectangle, grown by `grow` points
   * (negative insets it). Sampling the bounding box instead would ask for black
   * in the four corner areas, which are display, not hole.
   */
  function inRRect(c, grow) {
    const x0 = c.x - grow;
    const y0 = c.y - grow;
    const x1 = c.x + c.w + grow;
    const y1 = c.y + c.h + grow;
    const r = Math.max(c.r + grow, 0);
    return (xPt, yPt) => {
      const dx = Math.max(x0 + r - xPt, 0, xPt - (x1 - r));
      const dy = Math.max(y0 + r - yPt, 0, yPt - (y1 - r));
      return dx * dx + dy * dy <= r * r;
    };
  }

  /**
   * A short surface must never turn into a short check.
   *
   * Clamping the scan to the pixels that exist would quietly stop testing the
   * rows above them, and the day a mask grows past the surface the check would
   * go green by looking at less. So it is a failure, and a loud one.
   */
  function reach(hPx, g, y1, what) {
    if (y1 * g.scale <= hPx - 1) {
      return true;
    }
    console.log(
      `  FAIL ${what} needs ${y1.toFixed(0)} pt but only ${hPx / g.scale} pt was rendered`,
    );
    failures += 1;
    return false;
  }

  /** Worst channel over every pixel the predicate accepts, plus how many missed. */
  function scan(px, wPx, hPx, g, inside, bounds) {
    const yFrom = Math.max(Math.ceil(bounds.y0 * g.scale), 0);
    const yTo = Math.min(Math.floor(bounds.y1 * g.scale), hPx - 1);
    const xFrom = Math.max(Math.ceil(bounds.x0 * g.scale), 0);
    const xTo = Math.min(Math.floor(bounds.x1 * g.scale), wPx - 1);
    let worst = 0;
    let bad = 0;
    for (let y = yFrom; y <= yTo; y += 1) {
      for (let x = xFrom; x <= xTo; x += 1) {
        if (!inside(x / g.scale, y / g.scale)) {
          continue;
        }
        const i = (y * wPx + x) * 4;
        const v = Math.max(px[i], px[i + 1], px[i + 2]);
        if (v > worst) worst = v;
        if (v !== 0) bad += 1;
      }
    }
    return { worst, bad };
  }

  /**
   * Renders the recipe and returns its pixels.
   *
   * `heightPt` shrinks the *surface*, not the geometry: the recipe still draws
   * for a whole screen and Skia clips it, so every pixel returned is the pixel
   * that would be exported. Every check here looks at the top of the screen,
   * and CanvasKit rasterises the gradient's shader per pixel on the CPU, so
   * asking for the 800 points nobody inspects costs minutes of CI for nothing.
   */
  function render(g, mask, palette, heightPt) {
    const wPx = Math.round(g.width * g.scale);
    const hPx = Math.round(Math.min(heightPt ?? g.height, g.height) * g.scale);
    const surface = Skia.Surface.Make(wPx, hPx);
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color("#000000"));
    canvas.scale(g.scale, g.scale);
    drawRecipe(canvas, {
      recipe: { source: presetSource(palette), mask },
      geometry: g,
      image: null,
    });
    surface.flush();
    const img = surface.makeImageSnapshot();
    const px = img.readPixels(0, 0, {
      width: wPx,
      height: hPx,
      colorType: types.ColorType.RGBA_8888,
      alphaType: types.AlphaType.Unpremul,
    });
    return { px, wPx, hPx };
  }

  // -- 1. Absolute black over the cutout, and a margin beside it -------------
  //
  // Two scans of the same shape at two sizes. Inset by 2 pt, every pixel must be
  // black or the hole shows in a dark room.
  //
  // Grown by HALO, every pixel beside the cutout must be black too, and that is
  // the check that nearly went missing. Black stopping exactly where the hole
  // stops does hide the hole, in the sense that there is no longer a boundary
  // near it, but it hands the cutout's own outline back to the eye drawn in
  // black at full contrast. A mask can pass "the cutout is covered" and still
  // be a picture of the cutout.
  //
  // Beside, not below. A family that spans the screen shares only a straight
  // horizontal edge with the cutout, which is a line and not a silhouette, and
  // how far below the cutout that edge sits is each family's own decision: the
  // bar's whole minimum is that it may sit exactly on it.
  const HALO = 8;
  console.log("\n-- Cutout coverage and halo (absolute black expected) --");
  for (const [devName, g] of Object.entries(devices)) {
    for (const family of ["bar", "stripes", "fade"]) {
      const { px, wPx, hPx } = render(g, defaultMask(family, g), "ember", TOP);
      const c = g.cutout;

      reach(hPx, g, c.y + c.h + HALO, `${devName} ${family} halo`);
      const core = scan(px, wPx, hPx, g, inRRect(c, -2), {
        x0: c.x + 2,
        y0: c.y + 2,
        x1: c.x + c.w - 2,
        y1: c.y + c.h - 2,
      });
      const halo = scan(px, wPx, hPx, g, inRRect(c, HALO), {
        // Stopping a point short of the cutout's bottom keeps the bar at its
        // minimum out of it: that edge lands exactly there, and its own
        // antialiased row is not a hole showing through.
        x0: c.x - HALO,
        y0: 0,
        x1: c.x + c.w + HALO,
        y1: c.y + c.h - 1,
      });

      const ok = core.worst === 0 && halo.worst === 0;
      if (!ok) failures += 1;
      console.log(
        `  ${ok ? "ok  " : "FAIL"} ${devName.padEnd(19)} ${family.padEnd(8)} ` +
          `cutout max ${core.worst}, +${HALO} pt halo max ${halo.worst}` +
          `${halo.bad ? `  (${halo.bad} non black pixels in the halo)` : ""}`,
      );
    }
  }

  // -- 1b. Every family reaches the floor ------------------------------------
  //
  // The masks are full width bands, so the only thing about a cutout that has
  // ever mattered is how far down it reaches. `maskFloor` is that line, and
  // where it comes from depends on who answered: the hole itself where the
  // device measured it, the hole plus a margin of doubt where a table said so,
  // the safe area where nobody knows.
  //
  // Each family at its own thinnest *default*, since a family reaching the
  // floor is what makes the floor mean anything. The bar's slider goes lower
  // than this on purpose, and that is checked separately below.
  console.log("\n-- The floor, at every family's default (absolute black expected) --");
  for (const [devName, g] of Object.entries(devices)) {
    const floor = maskFloor(g);
    const minimums = {
      bar: { type: "bar", height: floor, corner: 0.35 },
      stripes: { type: "stripes", density: 1 },
      fade: { type: "fade", fadeEnd: fadeSolidEnd(g) + 40, curve: 2 },
    };
    for (const [family, mask] of Object.entries(minimums)) {
      const { px, wPx, hPx } = render(g, mask, "ember", TOP);
      reach(hPx, g, floor, `${devName} ${family} floor`);
      // A pixel short on both edges. The bottom row is the mask's own
      // antialiased edge, and the right hand column is the screen's: 412 points
      // at 2.625 is 1081.5 pixels, so the last column of an Android surface is
      // half a pixel of paint whatever is drawn. Asking a boundary to be
      // absolute is asking the wrong thing.
      const band = scan(px, wPx, hPx, g, () => true, {
        x0: 0,
        y0: 0,
        x1: g.width - 1 / g.scale,
        y1: floor - 1 / g.scale,
      });
      const ok = band.worst === 0;
      if (!ok) failures += 1;
      console.log(
        `  ${ok ? "ok  " : "FAIL"} ${devName.padEnd(19)} ${family.padEnd(8)} ` +
          `${floor.toFixed(1)} pt band, max ${band.worst}` +
          `${band.bad ? `  (${band.bad} non black pixels)` : ""}`,
      );
    }
  }

  // -- 1b bis. How far under the floor the slider is allowed ------------------
  //
  // The bar goes below the floor, which reads like a hole in the product until
  // you ask how a hole gets measured: no screenshot ever contains one, so the
  // only instrument is the black itself, lowered until the edge appears. The
  // height it appears at is the answer, and without that travel there is no way
  // to correct a table or to stop being needlessly tall on a phone nobody here
  // has heard of.
  //
  // What is checked is that the travel is bounded and that it is not offered
  // where it would be pure loss: a device that measured its own hole has
  // nothing to second guess, so its limit is its floor, exactly.
  console.log("\n-- How far under the floor the bar may go --");
  for (const [devName, g] of Object.entries(devices)) {
    const floor = maskFloor(g);
    const limit = barMinHeight(g);
    const under = floor - limit;
    const ok =
      g.cutoutFrom === "system"
        ? under === 0
        : under > 0 && under <= Math.max(4, g.insetTop * 0.2 + 0.001);
    if (!ok) failures += 1;
    console.log(
      `  ${ok ? "ok  " : "FAIL"} ${devName.padEnd(19)} floor ${floor.toFixed(1)} pt, ` +
        `slider stops at ${limit.toFixed(1)}, ${under.toFixed(1)} pt under  (${g.cutoutFrom})`,
    );
  }

  // -- 1c. The two exact answers, where they exist ---------------------------
  //
  // The safe area keeps a mask safe, and that is all it does. What shape the
  // hole is, and where across the width it sits, is what the preview draws, and
  // both platforms answer that differently: Android hands over a rectangle in
  // pixels, iOS hands over nothing and gets read off a table of iPhones.
  //
  // Neither can make a mask leak, since the mask is measured from the safe
  // area. Both can draw the wrong phone, which is the thing to check.
  console.log("\n-- Where the system says the hole is --");
  {
    /** Real boxes, in display pixels, as `DisplayCutout` reports them. */
    const rects = [
      ["centred punch hole", { x: 497, y: 34, w: 88, h: 88 }, 2.625, "punch"],
      ["off centre punch hole", { x: 105, y: 34, w: 88, h: 88 }, 2.625, "punch"],
      ["wide notch", { x: 300, y: 0, w: 480, h: 80 }, 2.75, "notch"],
    ];
    for (const [what, rect, density, expected] of rects) {
      const { kind, cutout } = cutoutFromRect(rect, density);
      // Points, not pixels: everything downstream lays out in points, and a
      // hole measured in the wrong unit is a hole two and a half times too big.
      const ok = kind === expected && Math.abs(cutout.w - rect.w / density) < 0.01;
      if (!ok) failures += 1;
      console.log(
        `  ${ok ? "ok  " : "FAIL"} ${what.padEnd(21)} ${kind.padEnd(6)} ` +
          `${cutout.w.toFixed(1)} x ${cutout.h.toFixed(1)} pt at x = ${cutout.x.toFixed(1)}`,
      );
    }

    /** One iPhone per shape, plus the one that must not be found. */
    const models = [
      ["iPhone13,2", "notch", NOTCH_WIDE.w, "12"],
      ["iPhone14,5", "notch", NOTCH_NARROW.w, "13"],
      ["iPhone17,5", "notch", NOTCH_NARROW.w, "16e"],
      ["iPhone15,2", "island", ISLAND.w, "14 Pro"],
      ["iPhone99,1", null, 0, "a phone from the future"],
    ];
    for (const [id, kind, width, what] of models) {
      const got = cutoutForModel(id, 393);
      const ok = kind === null ? got === null : got?.kind === kind && got.cutout.w === width;
      if (!ok) failures += 1;
      console.log(
        `  ${ok ? "ok  " : "FAIL"} ${id.padEnd(21)} ` +
          (got ? `${got.kind}, ${got.cutout.w} pt wide` : "not in the table, safe area it is") +
          `  (${what})`,
      );
    }

    // Two rules at once. The floor always covers the hole. And it only stops
    // short of the safe area when there is a hole to stop at: a device that
    // knows nothing gets the safe area and no shortcuts, since the safe area
    // is then the only line that cannot be wrong.
    for (const [devName, g] of Object.entries(devices)) {
      const floor = maskFloor(g);
      const covers = floor >= cutoutBottom(g);
      const grounded = floor >= g.insetTop || g.cutoutFrom !== "safeArea";
      const ok = covers && grounded;
      if (!ok) failures += 1;
      console.log(
        `  ${ok ? "ok  " : "FAIL"} ${devName.padEnd(21)} black reaches ${floor.toFixed(1)} pt, ` +
          `hole ends at ${cutoutBottom(g).toFixed(1)}, safe area at ${g.insetTop}` +
          `  (${g.cutoutFrom})`,
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
    const { px, wPx, hPx } = render(g, mask, "ember", TOP);
    const isBlack = (xPt, yPt) => {
      const i = (Math.round(yPt * g.scale) * wPx + Math.round(xPt * g.scale)) * 4;
      return px[i] === 0 && px[i + 1] === 0 && px[i + 2] === 0;
    };
    const r = barRadius(mask.corner, g);
    reach(hPx, g, mask.height + Math.max(r * 0.3, 2), `${devName} bar corner`);

    // A device whose cutout is unknown gets no fillet at all: there is no
    // shape to join, so the bar is a plain band and a curve there would be a
    // decoration pretending to be a phone. That is a different assertion, not
    // a weaker one: the band still has to stop where it says it stops.
    if (r === 0) {
      const ok = isBlack(1, mask.height - 2) && !isBlack(1, mask.height + 2);
      if (!ok) failures += 1;
      console.log(
        `  ${ok ? "ok  " : "FAIL"} ${devName.padEnd(19)} square bar (no known cutout)  ` +
          `black above the bar line, wallpaper below`,
      );
      continue;
    }

    // Far enough below the bar line to be well inside the fillet at x = 1, and
    // far enough above its foot to still be outside it in the middle.
    const below = mask.height + r * 0.3;
    const above = mask.height - 2;

    const edgeBelow = isBlack(1, below) && isBlack(g.width - 1, below);
    const middleBelow = isBlack(g.width / 2, below);
    const edgeAbove = isBlack(1, above) && isBlack(g.width - 1, above);

    const ok = edgeBelow && !middleBelow && edgeAbove;
    if (!ok) failures += 1;
    console.log(
      `  ${ok ? "ok  " : "FAIL"} ${devName.padEnd(19)} radius = ${r.toFixed(2)} pt  ` +
        `edge below the bar line ${edgeBelow ? "black" : "NOT black"}, ` +
        `middle ${middleBelow ? "BLACK" : "not black"}`,
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

      const ok = bands.length >= 6 && firstGap >= 4 && thinnest >= 1 && monotonic && cover < 0.7;
      if (!ok) failures += 1;
      console.log(
        `  ${ok ? "ok  " : "FAIL"} ${devName.padEnd(19)} density ${density.toFixed(1)}  ` +
          `${String(bands.length).padStart(2)} bands, first slit ${firstGap.toFixed(1)} pt, ` +
          `thinnest ${thinnest.toFixed(1)} pt, ${monotonic ? "dissolving" : "NOT dissolving"}, ` +
          `${(cover * 100).toFixed(0)} % black`,
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
  const { px, wPx, hPx } = render(g, { type: "fade", fadeEnd, curve: 0 }, "haze", fadeEnd + 20);
  reach(hPx, g, fadeEnd, "fade");
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
  console.log(
    `  noise active on ${activity.toFixed(1)} % of horizontal pairs (0 % = no dithering)`,
  );
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

  // -- The demo script -------------------------------------------------------
  //
  // Not a pixel, but the same kind of property: `deliver` skips an App Preview
  // outside Apple's 15 to 30 second window with a warning and still reports
  // success, so a script edited past the edge would be found out at the store
  // rather than here.
  console.log("\n-- Demo script --");
  const { DEMO, DEMO_MS } = require(path.join(HARNESS, "demo/script.js"));
  console.log(`  ${DEMO.length} steps, ${(DEMO_MS / 1000).toFixed(1)} s`);
  if (DEMO_MS < 15000 || DEMO_MS > 30000) {
    console.log("  FAIL outside Apple's 15 to 30 s App Preview window");
    failures += 1;
  } else {
    console.log("  ok   inside the App Preview window");
  }

  console.log(failures === 0 ? "\nAll green.\n" : `\n${failures} failure(s).\n`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
