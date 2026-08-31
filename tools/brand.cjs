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

/**
 * The blueprint grid, at 512, exactly as Sketch drew it.
 *
 * Two diagonals, five rules each way and three rings, all on one construction
 * circle. It is drawn at 8.25 percent white: 25 percent stroke inside a group
 * at 33, which is faint enough to be texture and not decoration.
 */
const GRID = `
  <g opacity="0.33" fill="none" stroke="#F3EFEA" stroke-opacity="0.25" stroke-width="2">
    <path d="M0.16,0.29 L510.81,511.95 M510.81,0.29 L0.16,511.95"/>
    <path d="M33.07,0.29 L33.07,511.95 M158.74,0.29 L158.74,511.95 M255.49,0.29 L255.49,511.95
             M352.23,0.29 L352.23,511.95 M477.90,0.29 L477.90,511.95"/>
    <path d="M0.16,478.97 L510.81,478.97 M0.16,353.05 L510.81,353.05 M0.16,256.12 L510.81,256.12
             M0.16,159.18 L510.81,159.18 M0.16,33.27 L510.81,33.27"/>
    <circle cx="255.49" cy="256.12" r="222.42"/>
    <circle cx="255.49" cy="256.12" r="136.64"/>
    <circle cx="255.49" cy="256.12" r="96.75"/>
  </g>`;

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
function icon(side, { telling = ICON, alpha = 0.5, tone = "light" } = {}) {
  const k = side / 512;
  const band =
    telling === "plain"
      ? ""
      : `<g opacity="${alpha}" transform="scale(${k.toFixed(6)}) translate(-35,-48)">
           <path d="${BAND}" fill="#000000"/>
         </g>`;

  return square(side, `${markBlock(side, 0.76)}${band}`, { tone });
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

module.exports = {
  icon,
  square,
  markBlock,
  markPatch,
  feature,
  png,
  splash,
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
  }

  if (!tryOnly) {
    // Full bleed at 1024: iOS masks the corners itself, and asking for a
    // pre-rounded icon is how you get a rounded icon inside a rounded mask.
    // Three tones rather than one, because iOS 18 asks for three and derives
    // the two it is not given, badly. They are the same drawing: `dark` has the
    // light taken out of it for a dark home screen, `tinted` is grey so the
    // system can paint it in whatever colour the user picked.
    png(icon(1024), 1024, 1024, out("icon.png"));
    png(icon(1024, { tone: "dark" }), 1024, 1024, out("icon-dark.png"));
    png(icon(1024, { tone: "tinted" }), 1024, 1024, out("icon-tinted.png"));
    png(icon(64), 64, 64, out("favicon.png"));

    // Android's adaptive icon is two layers the system moves against each
    // other, so the marks cannot be baked into the background, and a third
    // monochrome layer is what a themed icon is cut from. All three are drawn
    // at 1024 over the 108 dp canvas: the outer 18 percent on each side can be
    // cropped by any launcher's mask, so nothing that matters goes there.
    png(square(1024, ""), 1024, 1024, out("android-icon-background.png"));
    png(
      square(1024, markBlock(1024, 0.5), { grid: false, background: false }),
      1024,
      1024,
      out("android-icon-foreground.png"),
    );
    png(
      square(1024, markBlock(1024, 0.5), { grid: false, background: false }),
      1024,
      1024,
      out("android-icon-monochrome.png"),
    );

    png(feature(1024, 500), 1024, 500, out("feature-graphic.png"));

    // Play wants the listing icon at exactly 512 and as a 32 bit PNG, and it
    // checks both. Apple wants 1024 with no alpha at all and takes it out of
    // the binary rather than the listing, which is why `icon.png` above is the
    // one and only file for the App Store.
    png(icon(512), 512, 512, out("play-icon.png"), { keepAlpha: true });

    // The marks alone, for Android's system splash, which is a colour and a
    // masked icon and nothing else. At half the square, because Android 12
    // masks a launch icon to a circle and only the inner two thirds of it are
    // certain to survive.
    png(
      square(1024, markBlock(1024, 0.5), { grid: false, background: false }),
      1024,
      1024,
      out("splash-icon.png"),
    );
  }

  // 1290 by 2796, which is an iPhone 15 Pro Max. It is scaled to cover whatever
  // screen it lands on, and a mesh gradient survives that without a seam.
  await splash(1290, 2796, out("splash.png"));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`\n  ${e.message}\n`);
    process.exit(1);
  });
}
