/**
 * Store screenshot compositor, prototype.
 *
 * Takes screen captures (1320 x 2868, the 6.9 inch iPhone slot) and lays them
 * out into App Store and Play Store artwork: headline, device frame, tilted 3D
 * device, before and after wipe. One HTML page per shot, rendered by headless
 * Chromium at exactly the store resolution, so what the browser paints is the
 * file that gets uploaded, with no resampling step in between.
 *
 * Why a browser rather than frameit: frameit composites a flat 2D bezel with
 * ImageMagick and has no notion of perspective. A CSS 3D transform is a real
 * homography, so a tilted phone is projected correctly, and the same page also
 * gives gradients, blend modes, web fonts and per locale text for free.
 *
 * Usage:
 *   node tools/marketing/compose.cjs [--spec marketing/shots.json]
 *                                    [--out marketing/renders/app-store]
 *                                    [--font path/to/Inter.woff2]
 *                                    [--only shot-id]
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const { check } = require("./fingerprint.cjs");

const ROOT = path.join(__dirname, "..", "..");

// --- device metrics, in store pixels ----------------------------------------
//
// The 6.9 inch iPhone, which is the only iPhone slot that has to be uploaded:
// App Store Connect scales it down to every smaller shelf. A deck that wants
// another phone says so in its spec, and the App Store deck says nothing
// because this is already it.
const DEFAULTS = {
  shot: { w: 1320, h: 2868 },
  // Dynamic Island, from src/geometry/devices.ts: 125 x 37.33 pt, 11 pt down.
  cutout: { shape: "island", w: 375, h: 112, y: 33, r: 56, x: 0.5 },
  // Screen corner radius and the metal around it, eyeballed from a 17 Pro Max.
  screenRadius: 165,
  bezel: 26,
  // Titanium: a rim that is lighter where the light is and darker where it is
  // not. A flat grey border is what makes a CSS phone look like a CSS phone.
  rim: "linear-gradient(150deg, #b9bcc0 0%, #6f7378 22%, #2c2e31 48%, #7d8186 78%, #cfd2d6 100%)",
};

let SHOT = DEFAULTS.shot;
let CUT = DEFAULTS.cutout;
let SCREEN_RADIUS = DEFAULTS.screenRadius;
let BEZEL = DEFAULTS.bezel;
let RIM = DEFAULTS.rim;

/**
 * The device the deck is drawn on.
 *
 * The cutout is the only part that is not decoration: it is the product. It is
 * always painted, in every shot, at absolute black, at the place the hardware
 * puts it. Two fictional phones is the whole requirement, one per store: an
 * iPhone with a Dynamic Island and an Android with a centred punch hole, since
 * nobody on Play has an island. Unlike the app, the deck *has* to draw the
 * hole: its phone is a drawing, so a hole that is not drawn is a phone that
 * does not have one.
 */
function applyDevice(device) {
  // Always from the defaults, never from whatever the last deck left behind.
  //
  // These are module state because one process used to mean one deck, which
  // stopped being true the day the workbench served both of them: the Play deck
  // was applied while the index was being built, the App Store deck says
  // nothing about its device because it *is* the default, and applying nothing
  // used to mean keeping what was there. So every iPhone slot came out 1080 by
  // 2400 with a punch hole in it.
  const d = { ...DEFAULTS, ...device };
  SHOT = d.shot;
  SCREEN_RADIUS = d.screenRadius;
  BEZEL = d.bezel;
  RIM = d.rim;
  CUT = { ...DEFAULTS.cutout, ...device?.cutout };
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

function chromePath() {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv) return fromEnv;
  const candidates = [
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ];
  const hit = candidates.find((p) => fs.existsSync(p));
  if (!hit) throw new Error("no Chromium found, set CHROME_PATH");
  return hit;
}

// Images and fonts go in as data URIs: a file:// page cannot fetch siblings
// under Chromium's default file access rules, and inlining also makes the page
// self contained enough to open by hand while iterating on a layout.
function dataUri(file, mime) {
  return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
}

/**
 * The screen inside the phone.
 *
 * Interface shots come from a simulator, wallpapers from the renderer, and the
 * page cannot tell the difference. A capture that has not been taken yet falls
 * back to its wallpaper and says so, loudly, rather than stopping the whole
 * deck: an incomplete deck is still worth looking at, a missing one is not.
 */
/**
 * A capture, or nothing at all.
 *
 * There used to be a fallback per shot, a rendered wallpaper standing in for a
 * capture that had not been taken. It meant a deck could be built out of things
 * that were never photographed and look finished, which is the one failure mode
 * worth making impossible here: a store listing that shows an app nobody ran.
 */
function screenUri(file, asset) {
  const abs = path.isAbsolute(file) ? file : path.join(ROOT, file);
  if (!fs.existsSync(abs)) {
    throw new Error(`no capture at ${file}\n    take one: npm run captures:ios / captures:android`);
  }
  return asset(abs, "image/png");
}

/**
 * The one difference between shooting a page and looking at one.
 *
 * A headless render is a single navigation with nothing behind it, so every
 * byte has to be in the document. A page being served has a server behind it,
 * and inlining four megabytes of capture per reload would make the workbench
 * slower than the thing it replaces. So the assets go through here, and this is
 * the only place the two modes are allowed to differ: everything else about
 * that page is the page that gets photographed.
 */
const inlineAsset = (abs, mime) => dataUri(abs, mime);

function fontFace(fontPath, asset) {
  if (!fontPath) return "";
  const abs = path.isAbsolute(fontPath) ? fontPath : path.join(ROOT, fontPath);
  if (!fs.existsSync(abs)) return "";
  return `@font-face {
    font-family: "Deck";
    src: url("${asset(abs, "font/woff2")}") format("woff2-variations");
    font-weight: 100 900;
  }`;
}

// --- the device ------------------------------------------------------------

/**
 * The phone, as HTML.
 *
 * The island is drawn as an absolute black pill on top of the capture, at the
 * exact place the hardware puts it, and that is the whole demonstration: over a
 * photo it reads as a hole, over the app's black it stops existing. Nothing in
 * the layout is allowed to fake that, so the pill is always painted, in every
 * shot, at #000000 like the panel around it.
 */
function device(screens, { wipe }) {
  const layers = screens
    .map((src, i) => {
      // A second capture on top, clipped to a fraction of the width, is the
      // before and after: same photo, same frame, one line between the two.
      const clip = i === 0 || wipe == null ? "" : `clip-path: inset(0 0 0 ${wipe * 100}%);`;
      return `<img class="screen" src="${src}" style="${clip}">`;
    })
    .join("\n");

  const seam =
    wipe == null || screens.length < 2
      ? ""
      : `<div class="seam" style="left:${wipe * 100}%"></div>`;

  return `<div class="phone">
    <div class="glass">
      ${layers}
      ${seam}
      ${CUT.shape === "none" ? "" : '<div class="cutout"></div>'}
      <div class="gloss"></div>
    </div>
  </div>`;
}

// --- the seal ---------------------------------------------------------------

/**
 * One branch of a laurel wreath, drawn rather than drafted.
 *
 * The stem is a quadratic Bezier bulging outward and every leaf sits on it,
 * turned to the tangent and shrinking towards the tip, so the shape is a wreath
 * rather than a row of feathers. Drawn instead of drawn-by-hand because the
 * word inside it changes length in six languages: "Free" becomes "Kostenlos"
 * becomes "アカウント不要", and a fixed image would either crop or float.
 *
 * A wreath means an award, so the words inside it must obviously not be one.
 * "Free" and "tips welcome" are promises and read as a seal. Anything that
 * sounds like a prize would be a prize this app never won.
 */
function laurel(w, mirror) {
  const h = w * 1.55;
  const P0 = [w * 0.96, h * 0.99];
  const P1 = [-w * 0.3, h * 0.6];
  const P2 = [w * 0.46, h * 0.01];
  const at = (t) => [
    (1 - t) * (1 - t) * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
    (1 - t) * (1 - t) * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1],
  ];
  const angle = (t) => {
    const dx = 2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]);
    const dy = 2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]);
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };
  let leaves = "";
  const n = 9;
  for (let i = 0; i < n; i += 1) {
    const t = 0.06 + (i / (n - 1)) * 0.88;
    const [x, y] = at(t);
    const k = 1 - t * 0.62;
    leaves += `<g transform="translate(${x} ${y}) rotate(${angle(t) + 34})">
      <ellipse cx="${-w * 0.2 * k}" cy="0" rx="${w * 0.21 * k}" ry="${w * 0.085 * k}"/></g>`;
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="currentColor"
    style="${mirror ? "transform:scaleX(-1)" : ""}">
    <path d="M ${P0[0]} ${P0[1]} Q ${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}" fill="none"
      stroke="currentColor" stroke-width="${w * 0.05}" stroke-linecap="round"/>
    ${leaves}</svg>`;
}

/**
 * Which faces this deck's language may fall back to, in order.
 *
 * The vendored face is Latin only, so a CJK deck has to name something that
 * carries its script. What it must not do is name one for a *Latin* deck: the
 * first font in the list that has the glyph wins, and with Hiragino Sans in the
 * list a Mac drew every French headline in Hiragino. That is where the ellipsis
 * floating in the middle of the line came from: U+2026 is centred in CJK
 * typography, and correctly so, on a line that was never meant to be CJK.
 */
function stack(lang) {
  const cjk = {
    ja: ['"Hiragino Sans"', '"Noto Sans CJK JP"'],
    "zh-Hans": ['"PingFang SC"', '"Noto Sans CJK SC"'],
  };
  return ['"Deck"', ...(cjk[lang] ?? []), '"Helvetica Neue"', '"DejaVu Sans"', "sans-serif"].join(
    ", ",
  );
}

/** The seal itself: two branches around a word, with a line under it. */
function seal(s, u, k = 1) {
  if (!s) return "";
  const w = (s.size || 100) * u * k;
  return `<div class="seal">
    ${laurel(w, false)}
    <div class="sealText">
      <div class="sealWord">${s.word}</div>
      ${s.under ? `<div class="sealUnder">${s.under}</div>` : ""}
    </div>
    ${laurel(w, true)}
  </div>`;
}

// --- one shot --------------------------------------------------------------

function page(shot, deck, fontPath, asset = inlineAsset) {
  // `{lang}` in a path is the deck's own capture language: one deck per store
  // locale, one capture set per app language, and the two are not spelled the
  // same (App Store says fr-FR, the app says fr).
  const lang = deck.lang ?? "en";
  const fill = (f) => f.replace("{lang}", lang);
  // The closing card has no phone in it, so it has nothing to resolve.
  const screens =
    shot.layout === "card"
      ? []
      : (shot.screens || [shot.screen]).map((f) => screenUri(fill(f), asset));

  // The cutout lives inside the *screen*, so it scales with the screen and not
  // with the phone around it. Drawn at canvas size on a device at 0.78 it came
  // out a third too wide; drawn at the phone's scale it came out three per cent
  // too wide, which is the width of the metal it is sitting inside.
  const phoneWidth = Math.round(SHOT.w * (shot.scale || 0.74));
  const k = shot.layout === "full" ? 1 : (phoneWidth - BEZEL * 2) / SHOT.w;

  // Type follows the canvas. The App Store slot is 1320 wide and Play's is
  // 1080, and a headline set for one is a headline that wraps badly on the
  // other, which is exactly what happened the first time.
  const u = SHOT.w / 1320;
  // Centred, on both decks, because there are only two phones here and both are
  // fictional: an iPhone with an island and an Android with a hole in the
  // middle. A shot used to be able to move the hole off centre, back when the
  // before and after was composed here and a hole on the seam would have been
  // half demonstrated. The app draws that comparison itself now.
  const cutX = CUT.x;

  // Layouts differ only by how the phone sits in the frame, so they are one
  // transform each rather than one template each.
  const transform = {
    card: null, // no phone: the last slot is the promise, said once more
    full: null, // no frame at all, the capture fills the shot
    flat: "translateY(var(--drop))",
    tilt: "perspective(3400px) rotateX(6deg) rotateY(-17deg) rotateZ(-2deg) translateY(var(--drop))",
    // The same phone as `tilt`, pushed down until the frame cuts it in half.
    // The closing slot is a promise, not a demonstration: half a phone says
    // "this is the app" without asking to be read.
    half: "perspective(3400px) rotateX(6deg) rotateY(-17deg) rotateZ(-2deg) translateY(var(--drop))",
    "tilt-right":
      "perspective(3400px) rotateX(6deg) rotateY(17deg) rotateZ(2deg) translateY(var(--drop))",
  }[shot.layout || "flat"];

  // How far the phone is pushed down, and the one layout that has an opinion of
  // its own: `half` is a fraction of the canvas rather than a number per store,
  // because the two decks are not the same height.
  const drop = shot.drop ?? (shot.layout === "half" ? Math.round(SHOT.h * 0.3) : 0);

  const body =
    shot.layout === "card"
      ? ""
      : shot.layout === "full"
        ? `<img class="fullbleed" src="${screens[0]}">
         ${CUT.shape === "none" ? "" : '<div class="cutout fullbleed-cutout"></div>'}`
        : device(screens, { wipe: shot.wipe });

  const badges = (shot.badges || deck.badges || [])
    .map((b) => `<span class="badge">${b}</span>`)
    .join("");

  // The seal is the deck's own, and a shot says where it wants it: low over the
  // artwork on the first slot, in the middle of the last one.
  const sealHtml = shot.seal ? seal(deck.seal, u, shot.layout === "card" ? 1.45 : 1) : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  ${fontFace(fontPath, asset)}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${SHOT.w}px; height: ${SHOT.h}px; overflow: hidden; }
  body {
    --drop: ${drop}px;
    background: ${shot.background || deck.background};
    font-family: ${stack(lang)};
    color: ${shot.ink || deck.ink || "#ffffff"};
    display: flex; flex-direction: column; align-items: center;
    position: relative;
  }
  /* Copy sits in the top sixth: on the shelf, only the top of a screenshot is
     read before the thumb moves on. */
  .copy { padding: ${150 * u}px ${110 * u}px 0; text-align: center; z-index: 3; }
  h1 {
    font-size: ${(shot.size || 108) * u}px; font-weight: 680; line-height: 1.03;
    letter-spacing: -0.035em; white-space: pre-line;
  }
  h2 {
    margin-top: ${34 * u}px; font-size: ${52 * u}px; font-weight: 420; line-height: 1.25;
    letter-spacing: -0.01em; opacity: 0.72; white-space: pre-line;
  }
  .badges { margin-top: ${46 * u}px; display: flex; gap: ${20 * u}px; justify-content: center; }
  .badge {
    font-size: ${38 * u}px; font-weight: 560; letter-spacing: 0.01em;
    padding: ${16 * u}px ${32 * u}px; border-radius: 999px;
    background: rgba(255,255,255,0.10);
    border: 2px solid rgba(255,255,255,0.16);
  }

  .stage { flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; }

  /* The aspect ratio belongs to the screen, not to the phone.
     Carried by the phone, the bezel ate into it: the glass came out
     proportionally taller than the capture, and \`object-fit: cover\` paid for
     that by cropping 1.4 % off each side of every screenshot in the deck. */
  .phone {
    width: ${phoneWidth}px;
    transform: ${transform || "none"};
    transform-style: preserve-3d;
    border-radius: ${SCREEN_RADIUS + BEZEL}px;
    padding: ${BEZEL}px;
    background: ${RIM};
    box-shadow:
      0 90px 160px -40px rgba(0,0,0,0.75),
      0 10px 40px rgba(0,0,0,0.45),
      inset 0 0 0 2px rgba(255,255,255,0.16);
  }
  .glass {
    position: relative; width: 100%; aspect-ratio: ${SHOT.w} / ${SHOT.h};
    overflow: hidden; border-radius: ${SCREEN_RADIUS}px; background: #000;
  }
  .screen { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .seam { position: absolute; top: 0; bottom: 0; width: 4px; background: rgba(255,255,255,0.85); }
  .cutout {
    position: absolute; top: ${CUT.y * k}px; left: ${cutX * 100}%;
    width: ${CUT.w * k}px; height: ${CUT.h * k}px; margin-left: ${(-CUT.w * k) / 2}px;
    border-radius: ${CUT.r * k}px; background: #000000;
  }
  /* A single highlight sweeping the glass. Anything stronger reads as a
     reflection of a studio that is not there. */
  .gloss {
    position: absolute; inset: 0; border-radius: ${SCREEN_RADIUS}px;
    background: linear-gradient(102deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 18%,
                rgba(255,255,255,0) 42%, rgba(255,255,255,0) 100%);
    pointer-events: none;
  }
  .fullbleed { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .fullbleed-cutout { top: ${CUT.y}px; z-index: 2; }

  .caption {
    position: absolute; left: 0; right: 0; bottom: ${120 * u}px; z-index: 3;
    text-align: center; font-size: ${46 * u}px; font-weight: 500; opacity: 0.8;
    white-space: pre-line;
  }
  /* The seal, in the two places it goes: low over the artwork on the opening
     slot, and in the middle of the closing card. */
  /* Gold, because a seal that is the same white as everything else is a
     paragraph with leaves around it. The shadow lifts it off whatever the
     artwork is doing underneath, which on the opening slot is a photo. */
  .seal {
    display: flex; align-items: center; justify-content: center; gap: ${8 * u}px;
    color: #F0CE7C;
    filter: drop-shadow(0 ${10 * u}px ${26 * u}px rgba(0,0,0,0.7));
  }
  .sealText { text-align: center; }
  .card .sealWord { font-size: ${96 * u}px; }
  .card .sealUnder { font-size: ${33 * u}px; }
  .sealWord {
    font-size: ${68 * u}px; font-weight: 800; letter-spacing: -0.02em; line-height: 1;
    background: linear-gradient(180deg, #FFF1CB 0%, #F0CE7C 46%, #C08A28 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .sealUnder {
    margin-top: ${12 * u}px; font-size: ${25 * u}px; font-weight: 600;
    letter-spacing: 0.07em; text-transform: uppercase; opacity: 0.66; white-space: nowrap;
  }
  .sealLow {
    position: absolute; left: 0; right: 0; bottom: ${118 * u}px; z-index: 4;
    display: flex; justify-content: center;
  }
  .card {
    position: absolute; inset: 0; z-index: 3; display: flex; flex-direction: column;
    align-items: center; justify-content: flex-start; gap: ${44 * u}px;
    padding: ${420 * u}px ${120 * u}px 0;
    text-align: center;
  }
  .card h1 { margin-bottom: ${8 * u}px; }
  .copy .cardLine { margin-top: ${34 * u}px; }
  /* The sentence that has to be read, in the space between the copy and the
     phone: at the foot of the block nobody gets to it, and small enough to be
     fine print it says the opposite of what it means. */
  .midNote {
    position: absolute; left: ${150 * u}px; right: ${150 * u}px; top: 30%;
    z-index: 3; text-align: center;
    font-size: ${64 * u}px; font-weight: 460; line-height: 1.35; opacity: 0.78;
  }
  .cardLine { font-size: ${46 * u}px; font-weight: 480; line-height: 1.4; opacity: 0.8; }
  .cardArt {
    margin-top: ${120 * u}px; width: ${420 * u}px; height: ${420 * u}px;
    border-radius: ${94 * u}px;
    box-shadow: 0 ${40 * u}px ${90 * u}px rgba(0,0,0,0.55);
  }
  .cardNote { font-size: ${34 * u}px; font-weight: 460; line-height: 1.4; opacity: 0.62; }

  .labels { position: absolute; inset: 0; z-index: 3; }
  .label {
    position: absolute; font-size: 40px; font-weight: 600; letter-spacing: 0.06em;
    text-transform: uppercase; opacity: 0.85;
  }
</style></head>
<body>
  ${
    shot.headline && shot.layout !== "card"
      ? `<div class="copy"><h1>${shot.headline}</h1>${shot.sub ? `<h2>${shot.sub}</h2>` : ""}${
          shot.line ? `<div class="cardLine">${shot.line}</div>` : ""
        }${badges ? `<div class="badges">${badges}</div>` : ""}</div>`
      : ""
  }
  <div class="stage">${body}</div>
  ${
    shot.layout === "card"
      ? `<div class="card">
           ${shot.headline ? `<h1>${shot.headline}</h1>` : ""}
           ${sealHtml}
           ${shot.line ? `<div class="cardLine">${shot.line}</div>` : ""}
           ${shot.note ? `<div class="cardNote">${shot.note}</div>` : ""}
           ${shot.art ? `<img class="cardArt" src="${screenUri(shot.art, asset)}">` : ""}
         </div>`
      : sealHtml
        ? `<div class="sealLow">${sealHtml}</div>`
        : ""
  }
  ${shot.note ? `<div class="midNote">${shot.note}</div>` : ""}
  ${shot.caption ? `<div class="caption">${shot.caption}</div>` : ""}
  ${(shot.labels || [])
    .map(
      (l) =>
        `<div class="labels"><div class="label" style="left:${l.x}px;top:${l.y}px">${l.text}</div></div>`,
    )
    .join("")}
</body></html>`;
}

// --- driver ----------------------------------------------------------------

function render(html, out) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "deck-"));
  const file = path.join(tmp, "shot.html");
  fs.writeFileSync(file, html);
  execFileSync(
    chromePath(),
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--default-background-color=00000000",
      `--window-size=${SHOT.w},${SHOT.h}`,
      `--screenshot=${out}`,
      `file://${file}`,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  fs.rmSync(tmp, { recursive: true, force: true });
}

/**
 * The deck as the compositor sees it: defaults merged down, copy checked.
 *
 * Pulled out of `main` so the server can ask for the same thing without
 * rendering anything. One reading of a spec, one set of rules about what
 * overrides what.
 */
function readSpec(specPath) {
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, specPath), "utf8"));
  return {
    spec,
    /** Every shot of one locale, merged and checked, in deck order. */
    shots(locale) {
      const locales = spec.locales[locale];
      if (!locales) {
        throw new Error(`no locale "${locale}" in ${specPath}`);
      }
      // The deck's own defaults sit above the locale, which only overrides what
      // it has an opinion about. Without this the page asks a locale for a
      // background it never had, and a page with no background and white ink is
      // a white page with white text on it.
      const deck = { ink: spec.ink, background: spec.background, ...locales };
      const shots = (spec.shots ?? deck.shots).map((s) => {
        const said = deck.copy?.[s.id];
        if (spec.shots && !said) {
          throw new Error(`${locale} has no copy for the "${s.id}" shot`);
        }
        return { ...s, ...said };
      });
      return { deck, shots };
    },
  };
}

/** What a shot is called on the store, which is what the file is called here. */
function slotName(spec, shot, i) {
  const slot = spec.slot ? `${spec.slot}_` : "";
  return `${String(i + 1).padStart(2, "0")}_${slot}${shot.id}.png`;
}

/**
 * The face the deck is set in.
 *
 * Vendored rather than borrowed from the machine: with no font of our own the
 * first name in the fallback list that has the glyph wins, and on a Mac that is
 * whatever system face happens to sit there, which is how six decks came out
 * set in Hiragino Sans.
 */
function deckFont() {
  const vendored = path.join(ROOT, "marketing/fonts/InterVariable.woff2");
  return process.env.DECK_FONT ?? (fs.existsSync(vendored) ? vendored : undefined);
}

function main() {
  const read = readSpec(arg("spec", "marketing/shots.json"));
  const spec = read.spec;
  const outDir = path.join(ROOT, arg("out", "marketing/renders/app-store"));
  const font = arg("font", deckFont());
  const only = arg("only", null);

  applyDevice(spec.device);

  // Captures are committed rather than regenerated, so the one thing that can
  // go quietly wrong is shipping a deck of an app that no longer looks like
  // this. Warn, do not stop: an out of date deck is still worth looking at.
  check(true);

  for (const locale of Object.keys(spec.locales)) {
    const { deck, shots } = read.shots(locale);
    const dir = path.join(outDir, locale);
    // Emptied first: the deck's shots are numbered, and a slot that was renamed
    // or dropped would otherwise sit there looking uploadable.
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });

    shots.forEach((shot, i) => {
      if (only && shot.id !== only) return;
      // Numbered: App Store Connect and Play both order by filename, and
      // deliver reads the device type out of it (IPHONE_67 is the 6.9 inch).
      // Play reads nothing from it, so the token is left out there.
      const name = slotName(spec, shot, i);
      const out = path.join(dir, name);
      render(page(shot, deck, font), out);
      const kb = (fs.statSync(out).size / 1024).toFixed(0);
      console.log(`${locale}/${name.padEnd(40)} ${SHOT.w}x${SHOT.h}  ${kb} kB`);
    });
  }
}

module.exports = {
  readSpec,
  slotName,
  applyDevice,
  page,
  render,
  deckFont,
  ROOT,
};

if (require.main === module) {
  try {
    main();
  } catch (e) {
    // A missing capture is something to go and take, not a stack trace to read.
    console.error(`\n  ${e.message}\n`);
    if (process.env.HTN_DEBUG) {
      console.error(e);
    }
    process.exit(1);
  }
}
