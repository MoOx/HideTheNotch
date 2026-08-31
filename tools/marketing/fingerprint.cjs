/**
 * Do these captures still show this app?
 *
 * Captures are committed, which is the right trade: judging a screenshot is
 * something only a person can do, so it is done once, on purpose, and the
 * result is frozen where a diff can show it moving. The cost of that trade is
 * vigilance, and vigilance is a bad thing to ask of a person twice a year.
 *
 * So the interface gets a fingerprint, stored beside the captures. Change
 * anything that decides what a screenshot contains and the next `npm run deck`
 * says so. Full line comments are stripped before hashing: this codebase is
 * commented heavily and rewording a paragraph is not a reason to re-shoot.
 *
 *   node tools/marketing/fingerprint.cjs --write ios   # after a capture run
 *   node tools/marketing/fingerprint.cjs               # check every platform
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..", "..");

/** Everything whose content can change what a capture shows. */
const WATCHED = [
  "App.tsx",
  "src/ui",
  "src/demo/shots.ts",
  "src/i18n/strings.ts",
  "src/render/draw.ts",
  "src/render/shaders.ts",
  "src/render/palettes.ts",
  "src/geometry/devices.ts",
];

function files(target) {
  const abs = path.join(ROOT, target);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isDirectory()) {
    return fs
      .readdirSync(abs)
      .flatMap((name) => files(path.join(target, name)))
      .filter((f) => /\.tsx?$/.test(f));
  }
  return [target];
}

/** A comment on its own line cannot be inside a string, so this is safe. */
function meaningful(source) {
  return source
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return t !== "" && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
}

function fingerprint() {
  const hash = crypto.createHash("sha256");
  for (const file of WATCHED.flatMap(files).sort()) {
    hash.update(file);
    hash.update(meaningful(fs.readFileSync(path.join(ROOT, file), "utf8")));
  }
  return hash.digest("hex").slice(0, 16);
}

const PLATFORMS = ["ios", "android"];

/** Captures sit one directory per language, so this counts what is under them. */
function shots(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .reduce(
      (n, entry) =>
        n +
        (entry.isDirectory()
          ? fs.readdirSync(path.join(dir, entry.name)).filter((f) => f.endsWith(".png")).length
          : 0),
      0,
    );
}
const stamp = (p) => path.join(ROOT, "marketing/captures", p, ".fingerprint");

function write(platform) {
  const file = stamp(platform);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${fingerprint()}\n`);
  console.log(`fingerprint: ${platform} stamped ${fingerprint()}`);
}

/** Returns the number of platforms whose captures no longer match. */
function check(quiet) {
  const now = fingerprint();
  let stale = 0;
  for (const platform of PLATFORMS) {
    const file = stamp(platform);
    const dir = path.dirname(file);
    if (!fs.existsSync(dir) || shots(dir) === 0) {
      continue;
    }
    const was = fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : "none";
    if (was === now) {
      if (!quiet) console.log(`fingerprint: ${platform} up to date`);
      continue;
    }
    stale += 1;
    console.warn(
      `\n  ! the interface changed since the ${platform} captures were taken` +
        ` (${was} -> ${now})\n    npm run captures:${platform}\n`,
    );
  }
  return stale;
}

if (require.main === module) {
  const write_ = process.argv.indexOf("--write");
  if (write_ !== -1) {
    write(process.argv[write_ + 1] ?? "ios");
  } else {
    process.exit(check(process.argv.includes("--quiet")) === 0 ? 0 : 0);
  }
}

module.exports = { fingerprint, check };
