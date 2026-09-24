/**
 * Fails when `assets/` is not what `tools/brand.cjs` draws.
 *
 *   node tools/check-brand.cjs
 *
 * The icon has one source, `tools/brand.cjs`, and eleven committed rasters that
 * every platform actually reads. Committed because a build must not need a
 * browser, which means the tree carries a copy of the drawing, which means the
 * copy can be a year behind it. It was: the Android layers were composed from
 * their own recipe and never got the band, so the phones showed the 2017 icon
 * while every other surface showed this one, and nothing anywhere said so.
 *
 * This says so. Every surface in the table is redrawn and compared to the file
 * in the tree, and the run fails if any of them differ, if `assets/` holds a PNG
 * nothing draws, or if `app.json` points at an image that is not in the table.
 * The fix is always the same one line, `npm run brand`.
 *
 * The comparison is deliberately not byte for byte. Two Chromiums disagree
 * along an antialiased edge, and a check that cries wolf on a runner upgrade is
 * a check that gets switched off. So a pixel counts as moved only when nothing
 * within one pixel of it matches, in either direction, which no rasteriser
 * difference survives and no change to the drawing does not.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { PNG } = require("pngjs");
const { ROOT, surfaces, draw, png } = require("./brand.cjs");

const ASSETS = path.join(ROOT, "assets");

/** How far a channel may move, and how much of the picture may move that far. */
const TOLERANCE = 24;
const ALLOWED = 0.002;

/** Alpha weighted, so transparency is compared rather than the colour under it. */
function delta(a, ia, b, ib) {
  const wa = a.data[ia + 3] / 255;
  const wb = b.data[ib + 3] / 255;
  let d = Math.abs(a.data[ia + 3] - b.data[ib + 3]);
  for (let c = 0; c < 3; c += 1) {
    d = Math.max(d, Math.abs(a.data[ia + c] * wa - b.data[ib + c] * wb));
  }
  return d;
}

/** The share of `a` that has no match within one pixel of the same place in `b`. */
function strayed(a, b) {
  let moved = 0;
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      const ia = (y * a.width + x) * 4;
      let best = 255;
      for (let dy = -1; dy <= 1 && best > TOLERANCE; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= b.height) {
          continue;
        }
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= b.width) {
            continue;
          }
          const d = delta(a, ia, b, (yy * b.width + xx) * 4);
          if (d < best) {
            best = d;
          }
          if (best <= TOLERANCE) {
            break;
          }
        }
      }
      if (best > TOLERANCE) {
        moved += 1;
      }
    }
  }
  return moved / (a.width * a.height);
}

/**
 * The PNG colour type, from the header rather than from the pixels.
 *
 * It is the one property of these files a store checks and a decoder hides:
 * Play wants the listing icon 32 bit and rejects it otherwise, and pngjs hands
 * back RGBA whatever the file says.
 */
function colourType(file) {
  const fd = fs.openSync(file, "r");
  const head = Buffer.alloc(26);
  fs.readSync(fd, head, 0, 26, 0);
  fs.closeSync(fd);
  return head[25];
}

/**
 * Runs `fn` with `console.log` muted, and gives it back whatever happens.
 *
 * brand.cjs prints every file it writes, and here that is noise: the line that
 * matters is the comparison. The `finally` is the whole point: a surface that
 * throws while drawing must not leave the rest of the run silent, which would
 * turn a loud failure into a quiet one.
 */
async function quietly(fn) {
  const log = console.log;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
  }
}

/** Every file in a directory, as paths relative to it, sorted. */
function tree(dir) {
  const found = [];
  const walk = (at, prefix) => {
    for (const entry of fs
      .readdirSync(at, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(at, entry.name), rel);
      } else {
        found.push(rel);
      }
    }
  };
  walk(dir, "");
  return found;
}

/**
 * A `.icon` bundle's layers, composited in order over its fill.
 *
 * Not a preview of the icon iOS 26 will show: the glass, the specular and the
 * shadows are the system's and cannot be had outside it. This is the geometry
 * alone, which is exactly the thing that can drift. An icon whose layers are a
 * different picture from `icon.png` is the same bug the Android layers had, one
 * platform further on, so the layers are composited back here and the result
 * has to be the icon.
 */
function flattened(dir, side) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "icon.json"), "utf8"));
  const fill = manifest["fill-specializations"][0].value;
  const [from, to] = fill["linear-gradient"].map((c) => {
    const [r, g, b] = c.split(":")[1].split(",").map(Number);
    return `rgb(${[r, g, b].map((v) => Math.round(v * 255)).join(",")})`;
  });
  const { start, stop } = fill.orientation;
  const layers = manifest.groups
    .flatMap((group) => group.layers)
    .map((layer) => {
      const svg = fs.readFileSync(path.join(dir, "Assets", layer["image-name"]));
      return (
        `<image href="data:image/svg+xml;base64,${svg.toString("base64")}"` +
        ` x="0" y="0" width="${side}" height="${side}"/>`
      );
    });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"
      viewBox="0 0 ${side} ${side}">
    <defs><linearGradient id="bg" x1="${start.x}" y1="${start.y}" x2="${stop.x}" y2="${stop.y}">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="${side}" height="${side}" fill="url(#bg)"/>
    ${layers.join("")}
  </svg>`;
}

/** Every image `app.json` names, as a bare file name. */
function referenced() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "app.json"), "utf8"));
  const found = new Set();
  const walk = (node) => {
    if (typeof node === "string") {
      if (/^\.\/assets\/.+\.(png|jpg|jpeg|icon)$/.test(node)) {
        found.add(path.basename(node));
      }
      return;
    }
    if (node && typeof node === "object") {
      for (const value of Object.values(node)) {
        walk(value);
      }
    }
  };
  walk(config);
  return found;
}

(async () => {
  const table = surfaces();
  const drawn = new Set(table.map((s) => s.file));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "check-brand-"));
  let failures = 0;

  console.log("\n-- assets/ against tools/brand.cjs --\n");
  for (const surface of table) {
    const mine = path.join(tmp, surface.file);
    const theirs = path.join(ASSETS, surface.file);

    if (!fs.existsSync(theirs)) {
      console.log(`  FAIL ${surface.file.padEnd(30)} missing from assets/`);
      failures += 1;
      continue;
    }

    await quietly(() => draw(surface, mine));

    // A bundle is text the recipe writes out, not a picture a browser draws, so
    // it is compared byte for byte and a file on either side that the other
    // does not have is a failure on its own.
    if (surface.bundle) {
      const theirFiles = tree(theirs);
      const myFiles = tree(mine);
      const strays = [
        ...myFiles.filter((f) => !theirFiles.includes(f)).map((f) => `${f} missing from assets/`),
        ...theirFiles.filter((f) => !myFiles.includes(f)).map((f) => `${f} drawn by nothing`),
        ...myFiles
          .filter((f) => theirFiles.includes(f))
          .filter(
            (f) =>
              !fs.readFileSync(path.join(mine, f)).equals(fs.readFileSync(path.join(theirs, f))),
          )
          .map((f) => `${f} differs`),
      ];
      for (const stray of strays) {
        failures += 1;
        console.log(`  FAIL ${surface.file.padEnd(30)} ${stray}`);
      }
      if (strays.length === 0) {
        console.log(`  ok   ${surface.file.padEnd(30)} ${theirFiles.length} files, byte for byte`);
      }
      continue;
    }

    const a = PNG.sync.read(fs.readFileSync(mine));
    const b = PNG.sync.read(fs.readFileSync(theirs));

    if (a.width !== b.width || a.height !== b.height) {
      console.log(
        `  FAIL ${surface.file.padEnd(30)} ${b.width}x${b.height} in the tree, ` +
          `${a.width}x${a.height} drawn`,
      );
      failures += 1;
      continue;
    }

    const bits = colourType(mine);
    const theirBits = colourType(theirs);
    const moved = Math.max(strayed(a, b), strayed(b, a));
    const ok = moved <= ALLOWED && bits === theirBits;
    if (!ok) {
      failures += 1;
    }
    console.log(
      `  ${ok ? "ok  " : "FAIL"} ${surface.file.padEnd(30)} ${b.width}x${b.height}, ` +
        `${(moved * 100).toFixed(2)} % moved` +
        (bits === theirBits ? "" : `, colour type ${theirBits} in the tree, ${bits} drawn`),
    );
  }

  // And the layers are the icon. `iconBundle` cuts `icon.png` into the layers
  // iOS 26 lights; composited back in the order the manifest lists them, they
  // have to be `icon.png` again.
  console.log("\n-- the iOS layers composite back to the icon --\n");
  for (const surface of table.filter((s) => s.bundle)) {
    const flat = path.join(tmp, "flattened.png");
    await quietly(() => png(flattened(path.join(ASSETS, surface.file), 1024), 1024, 1024, flat));
    const a = PNG.sync.read(fs.readFileSync(flat));
    const b = PNG.sync.read(fs.readFileSync(path.join(ASSETS, "icon.png")));
    const moved = Math.max(strayed(a, b), strayed(b, a));
    const ok = moved <= ALLOWED;
    if (!ok) {
      failures += 1;
    }
    console.log(
      `  ${ok ? "ok  " : "FAIL"} ${surface.file.padEnd(30)} ` +
        `${(moved * 100).toFixed(2)} % away from icon.png`,
    );
  }

  fs.rmSync(tmp, { recursive: true, force: true });

  // Nothing hand made in with the drawn files. A PNG in assets/ that no recipe
  // produces is exactly how the Android layers drifted in the first place.
  console.log("\n-- nothing in assets/ that nothing draws --\n");
  for (const file of fs.readdirSync(ASSETS).sort()) {
    const isDir = fs.statSync(path.join(ASSETS, file)).isDirectory();
    if ((!file.endsWith(".png") && !isDir) || drawn.has(file)) {
      continue;
    }
    console.log(`  FAIL ${file.padEnd(30)} in assets/, drawn by nothing`);
    failures += 1;
  }

  // And the other direction: an image the app asks for that is not in the
  // table is an image with no source.
  console.log("\n-- app.json points at drawn files only --\n");
  for (const file of [...referenced()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const ok = drawn.has(file);
    if (!ok) {
      failures += 1;
    }
    console.log(`  ${ok ? "ok  " : "FAIL"} ${file}`);
  }

  console.log(
    failures === 0
      ? "\nassets/ is the current drawing.\n"
      : `\n${failures} failure(s). Run \`npm run brand\` and commit what it writes.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
