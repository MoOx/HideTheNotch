/**
 * Vérifie sur les pixels réels les deux propriétés dont dépend toute l'app :
 *
 *  1. La découpe est couverte par du noir ABSOLU (0,0,0). Un « presque noir »
 *     se voit sur OLED en pièce sombre.
 *  2. Le fondu ne fait pas de banding : sur une descente de 8 bits, une valeur
 *     ne doit jamais rester constante sur une longue plage de lignes.
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

  const { drawRecipe } = require(path.join(HARNESS, "render/draw.js"));
  const { defaultMask } = require(path.join(HARNESS, "recipe/defaults.js"));
  const { ISLAND, NOTCH_WIDE } = require(path.join(HARNESS, "geometry/devices.js"));

  const devices = {
    "Dynamic Island": {
      kind: "island", width: 393, height: 852, scale: 3, insetTop: 59, insetBottom: 34,
      label: "", estimated: false,
      cutout: { x: (393 - ISLAND.w) / 2, y: ISLAND.y, w: ISLAND.w, h: ISLAND.h, r: ISLAND.r },
    },
    Encoche: {
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

  // ── 1. Noir absolu sur la découpe ─────────────────────────────────────────
  console.log("\n── Couverture de la découpe (noir absolu attendu) ──");
  for (const [devName, g] of Object.entries(devices)) {
    for (const family of ["bar", "stripes", "fade"]) {
      const { px, wPx } = render(g, defaultMask(family, g), "braise");
      const c = g.cutout;
      // La marge de 2 pt évite d'échantillonner l'antialiasing du bord.
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
        `  ${ok ? "✓" : "✗"} ${devName.padEnd(15)} ${family.padEnd(8)} ` +
          `canal max = ${worst}${bad ? `  (${bad} pixels non noirs)` : ""}`
      );
    }
  }

  // ── 2. Dithering du fondu ─────────────────────────────────────────────────
  //
  // Mesurer la plus longue plage verticale à valeur constante ne dit rien :
  // en fin de fondu la courbe rejoint la source, sa pente tend vers zéro, et
  // une plage plate y est normale — il n'y a aucune marche à masquer.
  //
  // Ce qui compte est ailleurs :
  //   a) le bruit atteint bien la sortie (des pixels voisins sur une même ligne
  //      doivent différer ; sans dithering ils seraient tous identiques) ;
  //   b) aucune plage plate dans la partie *raide* du fondu, où les marches de
  //      quantification se verraient.
  console.log("\n── Fondu dithéré ──");
  const g = devices["Dynamic Island"];
  const solidEnd = 52;
  const fadeEnd = 420;
  const { px, wPx } = render(g, { type: "fade", solidEnd, fadeEnd, curve: 0 }, "brume");
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
  console.log(`  bruit actif sur ${activity.toFixed(1)} % des paires horizontales (0 % = pas de dithering)`);
  if (activity < 15) {
    console.log("  ✗ dithering absent ou trop faible");
    failures += 1;
  } else {
    console.log("  ✓ dithering présent");
  }

  // Partie raide : les 60 premiers pour cent du fondu.
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
  console.log(`  plus longue plage plate dans la partie raide : ${longest} lignes`);
  if (longest > 16) {
    console.log("  ✗ marche visible probable");
    failures += 1;
  } else {
    console.log("  ✓ aucune marche significative");
  }

  console.log(failures === 0 ? "\nTout est vert.\n" : `\n${failures} échec(s).\n`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("ÉCHEC :", e);
  process.exit(1);
});
