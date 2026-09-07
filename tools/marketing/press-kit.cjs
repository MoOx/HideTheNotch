/**
 * The screenshots, web sized, for a page that draws its own layout.
 *
 *   npm run press-kit
 *
 * Output: marketing/press-kit/, the raw captures at a size a page can load,
 * and a manifest naming them.
 *
 * **What this does not do is copy the copy.** `marketing/listing.json` and
 * `marketing/privacy.md` are committed, the repository is public, and raw
 * GitHub serves both. A page reads them at their own URL. Generating a third
 * file with the same words in it would be the fourth place this app's
 * description lives, and the first one to go stale.
 *
 * **Nor the deck.** The deck is screenshots posed inside a drawn phone with the
 * headline burned into the picture, which is what a store demands and the wrong
 * material for a web page: text in an image cannot be selected, translated,
 * reflowed, or read aloud. A page rebuilds that layout in HTML and wants what
 * the deck started from, which is these.
 *
 * So the only thing here that has to be published is the pictures, because
 * captures are not committed. Everything else already has a URL.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "marketing", "press-kit");
const CAPTURES = path.join(ROOT, "marketing", "captures");

// One language of pictures. The words come from the listing, in six, and the
// screenshots are the same screens whatever is written on them.
const LOCALE = process.env.HTN_PRESS_LOCALE || "en";
// 720 wide is a phone screenshot at a size a page uses. The captures are 1320
// and 2 MB each, which is a page nobody waits for.
const WIDTH = process.env.HTN_PRESS_WIDTH || "720";
// The branch this is published to, which is where the site reads it.
const BRANCH = "press-kit";
const REPO = "MoOx/HideTheNotch";
// `HEAD` on raw GitHub means the default branch, whatever it is called. Naming
// a branch here is a link that breaks on the day it is merged and deleted, and
// it breaks by serving a 404 to a site build rather than by failing anything
// here, which is the worst way for it to break.
const SOURCE_REF = process.env.HTN_PRESS_REF || "HEAD";

const PLATFORMS = ["ios", "ipad", "android"];

const MAGICK = ["magick", "convert"].find((bin) => {
  try {
    execFileSync(bin, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
});

function fail(message, hint) {
  console.error(`\n  ${message}\n`);
  if (hint) console.error(`  ${hint}\n`);
  process.exit(1);
}

if (!MAGICK) {
  fail(
    "This needs ImageMagick to resize the screenshots.",
    "brew install imagemagick, or apt install imagemagick.",
  );
}

const present = PLATFORMS.filter((p) => fs.existsSync(path.join(CAPTURES, p, LOCALE)));
if (present.length === 0) {
  fail(
    `No captures under marketing/captures/*/${LOCALE}.`,
    "npm run captures:ios and captures:android take them, npm run deck:fetch " +
      "brings a set down from CI with HTN_WHAT=captures.",
  );
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const shots = {};
for (const platform of present) {
  const from = path.join(CAPTURES, platform, LOCALE);
  fs.mkdirSync(path.join(OUT, platform), { recursive: true });

  shots[platform] = fs
    .readdirSync(from)
    .filter((name) => name.endsWith(".png"))
    .sort()
    .map((name) => {
      // The capture's own name kept, because `03-home` says more to whoever
      // lays out the page than `03` does.
      const out = `${name.replace(/\.png$/, "")}.jpg`;
      execFileSync(MAGICK, [
        path.join(from, name),
        "-resize",
        `${WIDTH}x`,
        "-quality",
        "82",
        "-strip",
        path.join(OUT, platform, out),
      ]);
      return `${platform}/${out}`;
    });
}

execFileSync(MAGICK, [
  path.join(ROOT, "assets", "icon.png"),
  "-resize",
  "256x256",
  "-strip",
  path.join(OUT, "icon.png"),
]);

// `body` is the page's paragraph, and it rides along without this file knowing:
// the whole `copy` entry for a shot is carried through, so a field added to
// `shots.json` appears here on the next run. It is written in English only,
// because the page is in English only, and the other languages keep the
// headline and the subtitle they already had for the deck. A page that reads
// `body` should fall back to `sub` rather than assume it is there.
//
// The deck's own running order, joined to the pictures that are published.
//
// `marketing/shots.json` already knows which headline goes with which capture,
// in six languages, because that is what the App Store deck is composed from.
// A page rebuilding that story in HTML would otherwise retype all of it, and
// the two would part company on the first rewording.
//
// It is not readable from here as it stands, which is why this join exists: the
// spec points at `marketing/captures/ios/{lang}/05-compare.png`, a file that is
// not committed and not published, and its shape is full of things a page has
// no use for (perspective, drop shadows, seal geometry). So what comes out is
// the part a page needs: an order, a headline, a subtitle, and the name of a
// picture that has a URL.
//
// The three specs are parallel, same five ids against the same five captures,
// so one is read and the platform is a lookup rather than three files.
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, "marketing", "shots.json"), "utf8"));

const story = spec.shots.map((shot) => {
  // "marketing/captures/ios/{lang}/05-compare.png" -> "05-compare"
  const base = path.basename(shot.screen || "", ".png");
  const image = {};
  for (const platform of present) {
    const file = `${platform}/${base}.jpg`;
    if (fs.existsSync(path.join(OUT, file))) image[platform] = file;
  }
  return {
    id: shot.id,
    shot: base || null,
    image: Object.keys(image).length > 0 ? image : null,
    copy: Object.fromEntries(
      Object.entries(spec.locales).map(([locale, l]) => [locale, (l.copy || {})[shot.id] || null]),
    ),
  };
});

// Cards the deck draws with words and no screenshot. They are part of the story
// and a page has somewhere to put them, so they travel with the rest.
const drawn = new Set(spec.shots.map((s) => s.id));
for (const id of Object.keys(spec.locales["en-US"].copy || {})) {
  if (drawn.has(id)) continue;
  story.push({
    id,
    shot: null,
    image: null,
    copy: Object.fromEntries(
      Object.entries(spec.locales).map(([locale, l]) => [locale, (l.copy || {})[id] || null]),
    ),
  });
}

const extras = Object.fromEntries(
  Object.entries(spec.locales).map(([locale, l]) => [
    locale,
    { lang: l.lang, badges: l.badges || [], seal: l.seal || null },
  ]),
);

const raw = `https://raw.githubusercontent.com/${REPO}/${SOURCE_REF}`;
const manifest = {
  "//":
    "Generated by tools/marketing/press-kit.cjs and replaced on every run. " +
    "The words are not here on purpose: read them at the two URLs below, " +
    "which are the same files the two stores are fed from.",
  slug: "hide-the-notch",
  generated: new Date().toISOString().slice(0, 10),
  listing: `${raw}/marketing/listing.json`,
  privacy: `${raw}/marketing/privacy.md`,
  base: `https://raw.githubusercontent.com/${REPO}/${BRANCH}`,
  locale: LOCALE,
  width: Number(WIDTH),
  icon: "icon.png",
  shots,
  // A headline may carry a newline, because the deck breaks its titles by hand
  // rather than letting a column decide. A page is free to honour it or not.
  story,
  extras,
};

fs.writeFileSync(path.join(OUT, "index.json"), `${JSON.stringify(manifest, null, 2)}\n`);

let bytes = 0;
for (const platform of present) {
  for (const file of fs.readdirSync(path.join(OUT, platform))) {
    bytes += fs.statSync(path.join(OUT, platform, file)).size;
  }
}

console.log("");
for (const platform of present) {
  console.log(`  ${platform.padEnd(8)} ${shots[platform].length} shots`);
}
console.log(`  ${(bytes / 1024).toFixed(0)} kB at ${WIDTH}px wide, from ${LOCALE}`);
console.log(`  ${story.length} story steps, ${Object.keys(spec.locales).length} languages of copy`);
console.log("");
console.log("  The words stay where they are:");
console.log(`    ${manifest.listing}`);
console.log(`    ${manifest.privacy}`);
console.log("");
