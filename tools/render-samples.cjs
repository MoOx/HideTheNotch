/**
 * Exécute le VRAI code de rendu de l'app (src/render/draw.ts, shader compris)
 * contre CanvasKit, en Node, et écrit de vrais PNG. Rien n'est réimplémenté :
 * les modules transpilés sont chargés tels quels, seul le module natif
 * `@shopify/react-native-skia` est remplacé par son implémentation web.
 */
const path = require("path");
const fs = require("fs");
const Module = require("module");

const APP = path.join(__dirname, "..");
const HARNESS = path.join(APP, ".harness");
const OUT = path.join(APP, "renders");

const CanvasKitInit = require(path.join(APP, "node_modules/canvaskit-wasm/bin/canvaskit.js"));
const { JsiSkApi } = require(path.join(
  APP,
  "node_modules/@shopify/react-native-skia/lib/commonjs/skia/web"
));

(async () => {
  const CanvasKit = await CanvasKitInit({
    locateFile: (f) => path.join(APP, "node_modules/canvaskit-wasm/bin", f),
  });

  const Skia = JsiSkApi(CanvasKit);

  // L'app importe `Skia`, `TileMode`, `ImageFormat` depuis le paquet natif.
  // Les énumérations de RN Skia sont numériques et traduites côté web ; il faut
  // les prendre dans le paquet, pas dans CanvasKit.
  const types = require(path.join(
    APP,
    "node_modules/@shopify/react-native-skia/lib/commonjs/skia/types"
  ));
  const shim = { ...types, Skia };
  const realLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "@shopify/react-native-skia") return shim;
    return realLoad.apply(this, arguments);
  };
  global.__DEV__ = false;

  const { drawRecipe } = require(path.join(HARNESS, "render/draw.js"));
  const { fadeEffect } = require(path.join(HARNESS, "render/shaders.js"));
  const { defaultMask } = require(path.join(HARNESS, "recipe/defaults.js"));
  const { ISLAND, NOTCH_WIDE } = require(path.join(HARNESS, "geometry/devices.js"));

  console.log("shader de fondu compilé :", fadeEffect ? "oui" : "NON");

  const devices = {
    island: {
      label: "Dynamic Island · 393×852",
      kind: "island",
      width: 393,
      height: 852,
      scale: 3,
      insetTop: 59,
      insetBottom: 34,
      cutout: { x: (393 - ISLAND.w) / 2, y: ISLAND.y, w: ISLAND.w, h: ISLAND.h, r: ISLAND.r },
      estimated: false,
    },
    notch: {
      label: "Encoche · 390×844",
      kind: "notch",
      width: 390,
      height: 844,
      scale: 3,
      insetTop: 47,
      insetBottom: 34,
      cutout: { x: (390 - NOTCH_WIDE.w) / 2, y: 0, w: NOTCH_WIDE.w, h: NOTCH_WIDE.h, r: NOTCH_WIDE.r },
      estimated: false,
    },
  };

  fs.mkdirSync(OUT, { recursive: true });

  const jobs = [];
  for (const [devName, g] of Object.entries(devices)) {
    for (const family of ["bar", "stripes", "fade"]) {
      jobs.push({ devName, g, family, mask: defaultMask(family, g), palette: "aurore" });
    }
  }
  // Quelques variantes pour juger les réglages
  jobs.push({
    devName: "island", g: devices.island, family: "stripes", tag: "points",
    mask: { type: "stripes", variant: "dots", period: 24, decay: 0.5 }, palette: "braise",
  });
  jobs.push({
    devName: "island", g: devices.island, family: "stripes", tag: "grille",
    mask: { type: "stripes", variant: "grid", period: 28, decay: 0.35 }, palette: "mousse",
  });
  jobs.push({
    devName: "island", g: devices.island, family: "fade", tag: "long-lineaire",
    mask: { type: "fade", solidEnd: 48, fadeEnd: 320, curve: 0 }, palette: "brume",
  });
  jobs.push({
    devName: "island", g: devices.island, family: "bar", tag: "haut-rayon0",
    mask: { type: "bar", height: 120, radius: 0 }, palette: "encre",
  });

  for (const job of jobs) {
    const { g } = job;
    const wPx = Math.round(g.width * g.scale);
    const hPx = Math.round(g.height * g.scale);

    const surface = Skia.Surface.Make(wPx, hPx);
    if (!surface) throw new Error("pas de surface");
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color("#000000"));
    canvas.scale(g.scale, g.scale);

    drawRecipe(canvas, {
      recipe: { source: { type: "gradient", preset: job.palette, seed: 1 }, mask: job.mask },
      geometry: g,
      image: null,
    });
    surface.flush();

    const img = surface.makeImageSnapshot();
    const bytes = img.encodeToBytes(shim.ImageFormat.PNG, 100);
    const name = `${job.devName}-${job.family}${job.tag ? "-" + job.tag : ""}.png`;
    fs.writeFileSync(path.join(OUT, name), Buffer.from(bytes));
    console.log(`${name.padEnd(34)} ${wPx}×${hPx}  ${(bytes.length / 1024).toFixed(0)} Ko`);
  }
})().catch((e) => {
  console.error("ÉCHEC :", e);
  process.exit(1);
});
