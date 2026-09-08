/**
 * Every piece of brand artwork, from two vectors and the app's own renderer.
 *
 *   node tools/brand.cjs            writes assets/
 *   node tools/brand.cjs --try      writes renders/brand/, touches nothing
 *
 * The 2017 icon lived in a Sketch file, which meant one binary nobody could
 * diff and a set of exported PNGs nobody could regenerate. The pieces are
 * vectors now (`assets/logo.svg` for the marks, the grid below), and everything
 * else is composed here: the gradient, the grid, the cutout, the sizes.
 *
 * The splash is the odd one out and the reason this file exists at all. It is
 * not artwork, it is **the app's first frame, drawn early**: the same aurora
 * gradient under the same mask, rendered by `src/render/draw.ts` against
 * CanvasKit. The launch screen and the first frame of the app are therefore the
 * same picture, so the handover is the logo fading and the controls arriving
 * rather than one image being swapped for another.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { PNG } = require("pngjs");

const ROOT = path.join(__dirname, "..");
const HARNESS = path.join(ROOT, ".harness");

// --- ingredients ------------------------------------------------------------

/**
 * Which telling of the icon ships.
 *
 * `node tools/brand.cjs --try` renders all of them side by side into
 * `renders/brand/`, which is where the choice is made. One constant, so the
 * choice is a one line diff and not a re-export.
 */
const ICON = "band";

/** The 2017 gradient, at the 45 degrees it was always meant to be. */
const FROM = "#5497D0";
const TO = "#6821AF";

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const rgb = ([r, g, b]) =>
  `#${[r, g, b]
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

/**
 * The gradient, in the three tones iOS 18 asks an icon for.
 *
 * `light` is the icon. `dark` is the same drawing with the light taken out of
 * it, because a home screen in dark mode is a dark room and an icon lit for
 * daylight glares in it. `tinted` has to be **grey**: the system reads its
 * luminance and paints the result in whatever colour the user has chosen, so a
 * colour left in it is a colour fighting theirs. Each stop keeps its own
 * luminance, which is what makes the grey version still read as this icon
 * rather than as a grey rectangle.
 */
function tones(tone) {
  const lum = (c) => {
    const [r, g, b] = hex(c);
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return rgb([y, y, y]);
  };
  const dim = (c, k) => rgb(hex(c).map((v) => v * k));

  switch (tone) {
    case "dark":
      return { from: dim(FROM, 0.52), to: dim(TO, 0.52) };
    case "tinted":
      // Darkened as well as drained. The system paints the light parts, so a
      // mid grey field comes back as a solid slab of the user's colour with
      // white marks barely on top of it; taken down, the marks are the icon
      // again and the tint is the ground.
      return { from: dim(lum(FROM), 0.55), to: dim(lum(TO), 0.55) };
    default:
      return { from: FROM, to: TO };
  }
}

/** A number, in as few characters as it takes to be the same number. */
const n = (v) => Number(v.toFixed(3)).toString();

/**
 * The blueprint grid, at 512, exactly as Sketch drew it.
 *
 * Two diagonals, five rules each way and three rings, all on one construction
 * circle. It is drawn at 8.25 percent white: 25 percent stroke inside a group
 * at 33, which is faint enough to be texture and not decoration.
 *
 * `bleed` runs every line that many units past the square without moving any of
 * them, which is what Android's background layer needs: a launcher slides that
 * layer under its mask, so lines that stopped at the icon's own edge would show
 * their ends travelling.
 */
const RULES = [33.07, 158.74, 255.49, 352.23, 477.9];
const ACROSS = [478.97, 353.05, 256.12, 159.18, 33.27];
const RINGS = [222.42, 136.64, 96.75];
const CENTRE = { x: 255.49, y: 256.12 };
const EDGE = { x0: 0.16, y0: 0.29, x1: 510.81, y1: 511.95 };

function grid(bleed = 0) {
  const x0 = n(EDGE.x0 - bleed);
  const y0 = n(EDGE.y0 - bleed);
  const x1 = n(EDGE.x1 + bleed);
  const y1 = n(EDGE.y1 + bleed);
  const down = RULES.map((x) => `M${n(x)},${y0} L${n(x)},${y1}`).join(" ");
  const across = ACROSS.map((y) => `M${x0},${n(y)} L${x1},${n(y)}`).join(" ");
  const rings = RINGS.map((r) => `<circle cx="${CENTRE.x}" cy="${CENTRE.y}" r="${r}"/>`).join("");
  return `
  <g opacity="0.33" fill="none" stroke="#F3EFEA" stroke-opacity="0.25" stroke-width="2">
    <path d="M${x0},${y0} L${x1},${y1} M${x1},${y0} L${x0},${y1}"/>
    <path d="${down}"/>
    <path d="${across}"/>
    ${rings}
  </g>`;
}

/** The grid as the square icon wears it: stopping exactly at the square. */
const GRID = grid();

/** The pencil and the brush, white, from the one file that holds them. */
function marks() {
  const svg = fs.readFileSync(path.join(ROOT, "assets/logo.svg"), "utf8");
  return svg.slice(svg.indexOf("<g "), svg.lastIndexOf("</svg>"));
}

/** The marks, centred in a `w` by `h` box, filling `fill` of the width. */
function markPatch(w, h, fill) {
  const side = w * fill;
  return `<g transform="translate(${(w - side) / 2},${(h - side) / 2})">${markBlock(side, 1)}</g>`;
}

/**
 * The marks, centred in a square of `side`.
 *
 * `fill` is a fraction of the 492 unit height the 2017 design was drawn
 * against, not of the ink: measured, the marks are 368 x 375 inside logo.svg's
 * 512 box, centred to within a pixel. So the box is what gets centred here, and
 * the marks come with it.
 *
 * That distinction cost a visible mistake. Centring the 492 rather than the 512
 * left the marks sitting 10 units low at every size, which is 1.5 percent of an
 * icon: far too little to look like a bug and quite enough to look wrong.
 */
function markBlock(side, fill) {
  const k = (side * fill) / 492;
  const offset = (side - 512 * k) / 2;
  return `<g transform="translate(${offset.toFixed(2)},${offset.toFixed(2)}) scale(${k.toFixed(5)})">${marks()}</g>`;
}

// --- the icon ---------------------------------------------------------------

/**
 * The band, exactly as it was drawn in Sketch.
 *
 * Not a rounded rectangle. Its bottom corners turn **downwards** at the screen
 * edges and it rises in the middle, which is the app's own first family: black
 * that curves up at the edges reads as a card lying on the artwork, black that
 * curves down reads as the panel it is. The shape overflows the square by 35
 * units on each side and starts 48 above it, so what the icon mask keeps is the
 * middle of a band drawn for something wider.
 *
 * Kept as the path it came as, scaled, rather than rebuilt from numbers. The
 * arc is a hair off a true quarter circle, the two ends are a thousandth of a
 * unit apart, and every one of those accidents is what makes it that drawing
 * and not a reconstruction of it.
 */
const BAND = `M582,0 L582,214 L547,214 L547,212.000779
  C547,138.740311 499.9552,90.9626061 427.212178,90.0143781
  L425,90 L157,90 C83,90 35,138.000306 35,212.000779
  L35,214 L0,214 L0,0 L582,0 Z`;

/**
 * The icon, in one of two tellings.
 *
 * `plain` is the 2017 icon: gradient, grid, marks, and nothing said about what
 * the app does.
 *
 * `band` adds the thing it does, in the app's own shape, at half black so the
 * gradient runs underneath it and it belongs to the square rather than sitting
 * on it. It is the one that ships.
 *
 * A third telling drew the cutout itself, half swallowed by the black, on the
 * theory that the icon could be the demonstration. On the phone it was a black
 * rectangle stuck on the artwork, and no amount of dissolving it fixed that: an
 * icon is 60 pixels and a demonstration needs more room than that.
 */
function icon(side, opts = {}) {
  return square(side, iconBody(side, opts), { tone: opts.tone ?? "light" });
}

/**
 * The band, over a square of `side`.
 *
 * `bleed` runs it that many units past the square on three sides, changing
 * nothing inside it. That is the Android margin being filled: a launcher that
 * crops or slides the foreground layer finds the band still there rather than
 * the end of it.
 *
 * The numbers below are read off the path above, in its own coordinates: the
 * square sits at (35, 48) in them, the band's straight lower edge is at y = 90,
 * and where the square cuts its sides it is at its lowest, y = 214.
 */
function band(side, { alpha = 0.5, bleed = 0 } = {}) {
  const k = side / 512;
  const b = bleed / k;
  // With a margin to spill into, the band is clipped to the square and the
  // margin is filled with what the band *is* at each edge, rather than with
  // more of the drawing. The band is drawn for something wider than the icon
  // and ends out there in two rails, which inside a square icon are cut off by
  // the frame; on the Android canvas there is no frame until the launcher's
  // mask, so those rails would show as a pair of ears in the margin.
  //
  // What continues instead: the solid top across the whole width, and at each
  // side the depth the band has where the square cuts it, which is the whole
  // 214 since the shape is at its lowest exactly there. So the band runs off
  // both sides, the way a band across a screen does, and the only edge left in
  // the canvas is at the canvas edge, where nothing can reach it.
  const sides = [35 - b, 547].map(
    (x) =>
      `<rect x="${n(x)}" y="${n(48 - b)}" width="${n(b)}" height="${n(166 + b)}" fill="#000000"/>`,
  );
  const shape =
    bleed > 0
      ? `<defs><clipPath id="band"><rect x="35" y="48" width="512" height="512"/></clipPath></defs>` +
        `<rect x="${n(35 - b)}" y="${n(48 - b)}" width="${n(512 + 2 * b)}" height="${n(42 + b)}" fill="#000000"/>` +
        sides.join("") +
        `<g clip-path="url(#band)"><path d="${BAND}" fill="#000000"/></g>`
      : `<path d="${BAND}" fill="#000000"/>`;
  // One group at half opacity rather than each shape at half of its own:
  // overlapping them individually would darken the seam.
  return `<g opacity="${alpha}" transform="scale(${k.toFixed(6)}) translate(-35,-48)">
           ${shape}
         </g>`;
}

/**
 * The icon without its ground: the marks, and the band over them.
 *
 * Split out because Android wants exactly this half on its own layer, and the
 * whole point is that it is the same half. There is one drawing of this icon in
 * this file, and this is it.
 */
function iconBody(side, { telling = ICON, alpha = 0.5, bleed = 0 } = {}) {
  const over = telling === "plain" ? "" : band(side, { alpha, bleed });
  return `${markBlock(side, 0.76)}${over}`;
}

/** Gradient, grid, then whatever else, in a square of `side`. */
function square(side, body, { grid = true, background = true, tone = "light" } = {}) {
  const k = side / 512;
  const { from, to } = tones(tone);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"
      viewBox="0 0 ${side} ${side}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    ${background ? `<rect width="${side}" height="${side}" fill="url(#bg)"/>` : ""}
    ${grid ? `<g transform="scale(${k})">${GRID}</g>` : ""}
    ${body}
  </svg>`;
}

// --- the same icon, on Android's canvas -------------------------------------

/**
 * The adaptive icon: one drawing, on the canvas Android hands a launcher.
 *
 * That canvas is 108 units wide and only the middle 72 are certain to survive:
 * the launcher masks the result to whatever shape the phone's skin uses, and
 * slides the layers against each other when the icon is touched. So the icon
 * goes into the inner 72 at exactly the proportions it has everywhere else, and
 * everything that would stop at its edge is continued into the 18 unit margin,
 * which is the part a mask crops and a parallax uncovers.
 *
 * The split is what Android asks for and nothing more, ground from drawing:
 *
 *   background   the gradient and the grid
 *   foreground   the marks and the band
 *   monochrome   the marks alone
 *
 * The band stays out of the monochrome layer on purpose. A themed icon is cut
 * from that layer's alpha and repainted in one colour of the system's choosing,
 * so half opaque black would come back as a solid slab of that colour with the
 * marks lost inside it.
 *
 * This is also the drift this function exists to make impossible. The Android
 * layers were once composed here from their own recipe, marks on a gradient and
 * no band, so the phones ran a year behind the icon every other surface showed.
 * They are views of `iconBody` now: there is nothing left to forget to update.
 */
function adaptive(side, layer) {
  const inner = (side * 72) / 108;
  const off = (side - inner) / 2;
  const k = inner / 512;
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"
      viewBox="0 0 ${side} ${side}">`;
  const at = (body) => `<g transform="translate(${n(off)},${n(off)})">${body}</g>`;

  if (layer === "background") {
    // The gradient runs the diagonal of the *icon*, and is carried on past both
    // of its ends rather than stretched over the whole canvas: what a launcher
    // shows has to be the gradient every other surface shows, stop for stop.
    // The inner square covers the middle two thirds of the canvas diagonal, so
    // each end is extended by a quarter of the run, in the colour the ramp
    // would have reached there.
    const margin = off / side;
    const past = margin / (1 - 2 * margin);
    const ramp = (t) => rgb(hex(FROM).map((v, i) => v + t * (hex(TO)[i] - v)));
    return `${open}
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ramp(-past)}"/>
      <stop offset="1" stop-color="${ramp(1 + past)}"/>
    </linearGradient></defs>
    <rect width="${side}" height="${side}" fill="url(#bg)"/>
    ${at(`<g transform="scale(${k.toFixed(6)})">${grid(off / k)}</g>`)}
  </svg>`;
  }

  if (layer !== "foreground" && layer !== "monochrome") {
    throw new Error(`no such adaptive layer: ${layer}`);
  }
  const body = layer === "monochrome" ? markBlock(inner, 0.76) : iconBody(inner, { bleed: off });
  return `${open}
    ${at(body)}
  </svg>`;
}

// --- rendering --------------------------------------------------------------

function chromePath() {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv) {
    return fromEnv;
  }
  const candidates = [
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ];
  const hit = candidates.find((p) => fs.existsSync(p));
  if (!hit) {
    throw new Error("no Chromium found, set CHROME_PATH");
  }
  return hit;
}

/**
 * How many pixels of window are not viewport, measured rather than assumed.
 *
 * Headless Chromium takes `--window-size` for the *window* and screenshots the
 * whole of it, so the page gets a viewport that is shorter by whatever the
 * frame costs, and the picture comes back with a transparent strip along the
 * bottom. That strip is 88 pixels in this container and 0 on a Mac, which is
 * exactly the kind of number that must not be written down. So it is measured
 * once, from a box of a known height, and the window is asked for that much
 * bigger.
 */
let chromeHeight = null;
function windowChrome() {
  if (chromeHeight !== null) {
    return chromeHeight;
  }
  const probe = shoot(
    `<div style="width:200px;height:400px;background:#fff"></div>`,
    200,
    400,
    "probe",
  );
  let last = 0;
  for (let y = 0; y < probe.height; y += 1) {
    if (probe.data[(y * probe.width + 2) * 4 + 3] > 0) {
      last = y + 1;
    }
  }
  chromeHeight = Math.max(0, 400 - last);
  return chromeHeight;
}

/** A page, screenshotted, decoded, at whatever size the window gave. */
function shoot(body, w, h, name) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "brand-"));
  const file = path.join(tmp, `${name}.html`);
  const out = path.join(tmp, `${name}.png`);
  fs.writeFileSync(
    file,
    `<html><body style="margin:0;background:transparent">` +
      `<style>svg{display:block}</style>${body}</body></html>`,
  );
  execFileSync(
    chromePath(),
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--default-background-color=00000000",
      `--window-size=${w},${h}`,
      `--screenshot=${out}`,
      `file://${file}`,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const image = PNG.sync.read(fs.readFileSync(out));
  fs.rmSync(tmp, { recursive: true, force: true });
  return image;
}

/**
 * One SVG string to one PNG, at exactly the size asked for.
 *
 * `keepAlpha` forces a 32 bit file even when every pixel is opaque, which is
 * what Play asks for and checks.
 */
function png(svg, w, h, out, { keepAlpha = false } = {}) {
  const shot = shoot(svg, w, h + windowChrome(), "art");
  const image = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y += 1) {
    shot.data.copy(image.data, y * w * 4, y * shot.width * 4, y * shot.width * 4 + w * 4);
  }
  // Opaque artwork goes out as RGB rather than RGBA: a launch image is a
  // megabyte of smooth gradient and a fourth channel of solid 255 is a quarter
  // of it. Deflate at 9 because this runs once and ships forever.
  let opaque = !keepAlpha;
  for (let i = 3; i < image.data.length && opaque; i += 4) {
    opaque = image.data[i] === 255;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    PNG.sync.write(image, {
      deflateLevel: 9,
      colorType: opaque ? 2 : 6,
      inputHasAlpha: true,
    }),
  );
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`  ${path.relative(ROOT, out)}  ${w}x${h}  ${kb} kB`);
}

/**
 * Play's feature graphic, 1024 by 500, which it will not publish a listing
 * without.
 *
 * It is the only store asset with no equivalent anywhere else, and it is
 * cropped hard on some surfaces, so nothing is written in it and nothing that
 * matters goes near an edge: the same gradient and grid as the icon, the veil
 * across the top so the shape of the product is in it, and the marks in the
 * middle where every crop keeps them.
 */
function feature(w, h) {
  const k = h / 512;
  const solid = h * 0.14;
  const gone = h * 0.34;
  const a = solid / gone;
  const stops = ['<stop offset="0" stop-color="#000000" stop-opacity="1"/>'];
  for (let i = 0; i <= 8; i += 1) {
    const t = a + ((1 - a) * i) / 8;
    const x = (t - a) / (1 - a);
    const o = 1 - x * x * (3 - 2 * x);
    stops.push(
      `<stop offset="${t.toFixed(4)}" stop-color="#000000" stop-opacity="${o.toFixed(4)}"/>`,
    );
  }
  const island = { w: h * 0.36, hh: h * 0.09, y: h * 0.035 };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${FROM}"/><stop offset="1" stop-color="${TO}"/>
      </linearGradient>
      <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">${stops.join("")}</linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <g transform="translate(${(w - h) / 2},0) scale(${k})">${GRID}</g>
    <rect x="${(w - island.w) / 2}" y="${island.y}" width="${island.w}" height="${island.hh}"
          rx="${island.hh / 2}" fill="#000000"/>
    <rect x="-1" y="-1" width="${w + 2}" height="${gone + 1}" fill="url(#veil)"/>
    ${markPatch(w, h, 0.19)}
  </svg>`;
}

// --- the splash -------------------------------------------------------------

/**
 * The launch screen: the app's own wallpaper, drawn early.
 *
 * Not artwork. `src/render/draw.ts` draws the aurora gradient against
 * CanvasKit, exactly as it will draw it on the device a second later, so the
 * launch image and the first frame of the app are the same picture. The
 * handover is then the marks fading out, the black appearing at the top and
 * the controls arriving, rather than one image being swapped for another.
 *
 * The mask is deliberately *not* in it. Where the black starts depends on the
 * phone, and a launch image is scaled to cover a screen it knows nothing about,
 * so a band baked in at one height would land at the wrong one. The gradient
 * has no such problem: it is smooth, and cropping it is invisible. Which also
 * makes the black arriving part of the app opening rather than part of the
 * picture.
 */
async function splashArt(w, h) {
  const CanvasKitInit = require(path.join(ROOT, "node_modules/canvaskit-wasm/bin/canvaskit.js"));
  const { JsiSkApi } = require(
    path.join(ROOT, "node_modules/@shopify/react-native-skia/lib/commonjs/skia/web"),
  );
  const CanvasKit = await CanvasKitInit({
    locateFile: (f) => path.join(ROOT, "node_modules/canvaskit-wasm/bin", f),
  });
  const Skia = JsiSkApi(CanvasKit);
  const types = require(
    path.join(ROOT, "node_modules/@shopify/react-native-skia/lib/commonjs/skia/types"),
  );
  const Module = require("module");
  const realLoad = Module._load;
  Module._load = function (request) {
    if (request === "@shopify/react-native-skia") {
      return { ...types, Skia };
    }
    return realLoad.apply(this, arguments);
  };
  global.__DEV__ = false;

  const { sourceShader } = require(path.join(HARNESS, "render/draw.js"));
  const { presetSource } = require(path.join(HARNESS, "render/palettes.js"));

  // A 430 by 932 phone at three times, which is a middling modern iPhone. The
  // exact geometry only decides how the mesh is laid out over the rectangle,
  // and the whole point of a mesh is that it has no features to misplace.
  const g = {
    label: "",
    kind: "none",
    width: w / 3,
    height: h / 3,
    scale: 3,
    insetTop: 59,
    insetBottom: 34,
    cutout: { x: 0, y: 0, w: 0, h: 0, r: 0 },
    cutoutFrom: "safeArea",
  };

  const surface = Skia.Surface.Make(w, h);
  const canvas = surface.getCanvas();
  canvas.scale(g.scale, g.scale);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(sourceShader(presetSource("aurora"), g, null));
  canvas.drawRect(Skia.XYWHRect(0, 0, g.width, g.height), paint);
  surface.flush();

  const bytes = surface.makeImageSnapshot().encodeToBytes();
  Module._load = realLoad;
  return Buffer.from(bytes);
}

/**
 * The launch image: that gradient, with the marks over it.
 *
 * The gradient is drawn at a third of the size and scaled up by the compositor,
 * which is not a shortcut. The app dithers its gradients on purpose, at plus or
 * minus one bit per pixel, and that noise is exactly what a PNG cannot compress:
 * the same picture came out at 2.3 MB with it and 370 kB without.
 * Drawing it at a sixth and letting the compositor scale it up smooths the
 * noise away, and a mesh gradient has no detail to lose. The
 * marks stay vector, so nothing that has an edge is ever resampled.
 */
async function splash(w, h, out) {
  const art = await splashArt(Math.round(w / 3), Math.round(h / 3));
  const uri = `data:image/png;base64,${art.toString("base64")}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
      viewBox="0 0 ${w} ${h}">
    <image href="${uri}" x="0" y="0" width="${w}" height="${h}"/>
    ${markPatch(w, h, 0.4)}
  </svg>`;
  png(svg, w, h, out);
}

/**
 * Every file this script draws, and the one drawing each of them comes from.
 *
 * The table is the point: `main()` writes it, `tools/check-brand.cjs` redraws it
 * and compares, so `assets/` cannot drift from the recipe in either direction,
 * and adding a surface is a line here rather than a second drawing of the icon
 * somewhere else. `app.json` names these files and nothing but these files.
 */
function surfaces() {
  return [
    // Full bleed at 1024: iOS masks the corners itself, and asking for a
    // pre-rounded icon is how you get a rounded icon inside a rounded mask.
    // Three tones rather than one, because iOS 18 asks for three and derives
    // the two it is not given, badly. They are the same drawing: `dark` has the
    // light taken out of it for a dark home screen, `tinted` is grey so the
    // system can paint it in whatever colour the user picked.
    { file: "icon.png", side: 1024, art: () => icon(1024) },
    { file: "icon-dark.png", side: 1024, art: () => icon(1024, { tone: "dark" }) },
    { file: "icon-tinted.png", side: 1024, art: () => icon(1024, { tone: "tinted" }) },
    { file: "favicon.png", side: 64, art: () => icon(64) },

    // Android's adaptive icon: three layers, all of them views of the icon
    // above, on the 108 dp canvas `adaptive` explains.
    { file: "android-icon-background.png", side: 1024, art: () => adaptive(1024, "background") },
    { file: "android-icon-foreground.png", side: 1024, art: () => adaptive(1024, "foreground") },
    { file: "android-icon-monochrome.png", side: 1024, art: () => adaptive(1024, "monochrome") },

    { file: "feature-graphic.png", w: 1024, h: 500, art: () => feature(1024, 500) },

    // Play wants the listing icon at exactly 512 and as a 32 bit PNG, and it
    // checks both. Apple wants 1024 with no alpha at all and takes it out of
    // the binary rather than the listing, which is why `icon.png` above is the
    // one and only file for the App Store.
    { file: "play-icon.png", side: 512, keepAlpha: true, art: () => icon(512) },

    // The marks alone, for Android's system splash, which is a colour and a
    // masked icon and nothing else. The same layer a themed icon is cut from,
    // for the same reason: Android 12 masks a launch icon to a circle, and only
    // the inner two thirds of the canvas are certain to survive it.
    { file: "splash-icon.png", side: 1024, art: () => adaptive(1024, "monochrome") },

    // 1290 by 2796, which is an iPhone 15 Pro Max. It is scaled to cover
    // whatever screen it lands on, and a mesh gradient survives that without a
    // seam. The only surface here that is rendered rather than drawn, which is
    // why it writes itself instead of handing back an SVG.
    { file: "splash.png", w: 1290, h: 2796, draw: (out) => splash(1290, 2796, out) },
  ];
}

/** One surface, to one file. */
async function draw(surface, out) {
  if (surface.draw) {
    await surface.draw(out);
    return;
  }
  const w = surface.w ?? surface.side;
  const h = surface.h ?? surface.side;
  png(surface.art(), w, h, out, { keepAlpha: surface.keepAlpha === true });
}

module.exports = {
  icon,
  adaptive,
  square,
  markBlock,
  markPatch,
  feature,
  png,
  splash,
  surfaces,
  draw,
  GRID,
  FROM,
  TO,
  ROOT,
  HARNESS,
};

async function main() {
  const tryOnly = process.argv.includes("--try");
  const out = (f) => path.join(ROOT, tryOnly ? "renders/brand" : "assets", f);

  console.log(tryOnly ? "\nCandidates, into renders/brand:\n" : "\nBrand artwork, into assets:\n");

  if (tryOnly) {
    for (const telling of ["plain", "band"]) {
      png(icon(1024, { telling }), 1024, 1024, out(`icon-${telling}.png`));
      png(icon(180, { telling }), 180, 180, out(`icon-${telling}-180.png`));
    }
    // The one surface a candidate run still wants whole, since the marks over
    // the gradient are the thing being judged.
    await splash(1290, 2796, out("splash.png"));
    return;
  }

  for (const surface of surfaces()) {
    await draw(surface, out(surface.file));
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`\n  ${e.message}\n`);
    process.exit(1);
  });
}
