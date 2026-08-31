/**
 * The two store listings, written out of one file.
 *
 *   npm run listing
 *
 * `deliver` and `supply` both read a tree of small text files, and the two
 * trees disagree about almost everything: the folder names, the locale codes,
 * what a description is called, where screenshots live. Keeping them by hand
 * means writing the same sentence twice in six languages and finding out at
 * upload time that one of them is a character over the limit.
 *
 * So `marketing/listing.json` holds it once and this writes both. It also
 * checks every store limit before anything is uploaded, because a store
 * rejecting a listing costs a round trip and a review queue.
 *
 * Nothing here invents copy. If a locale is missing a field, that is an error
 * and not a reason to fall back to English: a half translated store page reads
 * worse than an English one.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const SOURCE = path.join(ROOT, "marketing/listing.json");
const APPLE = path.join(ROOT, "fastlane/metadata");
const PLAY = path.join(ROOT, "fastlane/metadata/android");
const SHOTS = path.join(ROOT, "fastlane/screenshots");

/**
 * Where the same language is called two different things.
 *
 * The keys are the deck's locales, which are Apple's, because that is what the
 * captures are already filed under. Play wants a region on Japanese and the
 * old country code for Simplified Chinese.
 */
const PLAY_LOCALE = {
  "en-US": "en-US",
  "fr-FR": "fr-FR",
  "de-DE": "de-DE",
  "es-ES": "es-ES",
  ja: "ja-JP",
  "zh-Hans": "zh-CN",
};

/**
 * Every limit the two stores enforce, and the one field each of them counts
 * differently. Exceeding one is a rejection, so it is a failure here.
 */
const LIMITS = {
  name: [30, "App Store name and Play title"],
  subtitle: [30, "App Store subtitle"],
  short: [80, "Play short description"],
  promo: [170, "App Store promotional text"],
  keywords: [100, "App Store keywords"],
  description: [4000, "description, both stores"],
  release: [4000, "release notes and changelog"],
};

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`);
}

/** Every PNG of a rendered deck, in order, copied under a numbered name. */
function screenshots(from, to) {
  if (!fs.existsSync(from)) {
    return 0;
  }
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(to, { recursive: true });
  const files = fs
    .readdirSync(from)
    .filter((f) => f.endsWith(".png"))
    .sort();
  files.forEach((f, i) => {
    // Both stores order screenshots by file name, so the deck's own order has
    // to survive as a number rather than as a directory listing.
    fs.copyFileSync(path.join(from, f), path.join(to, `${String(i + 1).padStart(2, "0")}-${f}`));
  });
  return files.length;
}

function main() {
  const spec = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
  const problems = [];

  console.log("\n  Listings, from marketing/listing.json\n");

  for (const [locale, copy] of Object.entries(spec.locales)) {
    for (const [field, [limit, what]] of Object.entries(LIMITS)) {
      const value = copy[field];
      if (typeof value !== "string" || value.trim() === "") {
        problems.push(`${locale}: ${field} is missing`);
      } else if ([...value].length > limit) {
        problems.push(
          `${locale}: ${what} is ${[...value].length} characters, the limit is ${limit}`,
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error(`  Nothing written:\n${problems.map((p) => `    ${p}`).join("\n")}\n`);
    process.exit(1);
  }

  let total = 0;
  for (const [locale, copy] of Object.entries(spec.locales)) {
    // --- App Store, what `deliver` reads --------------------------------------
    const apple = path.join(APPLE, locale);
    write(path.join(apple, "name.txt"), copy.name);
    write(path.join(apple, "subtitle.txt"), copy.subtitle);
    write(path.join(apple, "description.txt"), copy.description);
    write(path.join(apple, "keywords.txt"), copy.keywords);
    write(path.join(apple, "promotional_text.txt"), copy.promo);
    write(path.join(apple, "release_notes.txt"), copy.release);
    write(path.join(apple, "support_url.txt"), spec.urls.support);
    write(path.join(apple, "marketing_url.txt"), spec.urls.marketing);
    write(path.join(apple, "privacy_url.txt"), spec.urls.privacy);

    // --- Play, what `supply` reads -------------------------------------------
    const play = path.join(PLAY, PLAY_LOCALE[locale]);
    write(path.join(play, "title.txt"), copy.name);
    write(path.join(play, "short_description.txt"), copy.short);
    write(path.join(play, "full_description.txt"), copy.description);
    // `default.txt` rather than a file per version code: the note is the same
    // for every build of a release, and naming it after a number that fastlane
    // computes at upload time is how a changelog goes missing.
    write(path.join(play, "changelogs", "default.txt"), copy.release);

    const apple_n = screenshots(
      path.join(ROOT, "marketing/renders/app-store", locale),
      path.join(SHOTS, locale),
    );
    const play_n = screenshots(
      path.join(ROOT, "marketing/renders/play", PLAY_LOCALE[locale]),
      path.join(play, "images", "phoneScreenshots"),
    );

    // Play wants these two per locale, refuses the listing without the feature
    // graphic, and checks that the icon is exactly 512 and 32 bit. Which is why
    // it gets a file of its own rather than the App Store's 1024: Apple wants
    // that one at 1024 with no alpha channel at all, and takes it out of the
    // binary rather than the listing.
    for (const [asset, from] of [
      ["featureGraphic.png", "assets/feature-graphic.png"],
      ["icon.png", "assets/play-icon.png"],
    ]) {
      const source = path.join(ROOT, from);
      if (fs.existsSync(source)) {
        fs.mkdirSync(path.join(play, "images"), { recursive: true });
        fs.copyFileSync(source, path.join(play, "images", asset));
      }
    }

    total += apple_n + play_n;
    console.log(
      `  ${locale.padEnd(8)} -> ${PLAY_LOCALE[locale].padEnd(8)} ` +
        `${apple_n} App Store shots, ${play_n} Play shots` +
        `${apple_n && play_n ? "" : "   (run npm run deck first)"}`,
    );
  }

  console.log(`\n  App Store  ${path.relative(ROOT, APPLE)}`);
  console.log(`  Play       ${path.relative(ROOT, PLAY)}\n`);

  /**
   * A deck that is not there is not a listing without pictures, it is a
   * listing that deletes pictures.
   *
   * `upload_to_app_store` runs with `overwrite_screenshots: true`, which
   * removes what the record holds before uploading what it was given. Given
   * nothing, it removes everything, and the App Store page is left with text
   * and no images until somebody notices. Play is kinder, it keeps what it has
   * for anything the tree does not mention, but the shape of the mistake is
   * the same.
   *
   * The captures are not in git, so this is a state anyone can reach on a
   * fresh clone by running the lane before the pipeline. Stop here instead.
   *
   * HTN_TEXT_ONLY=1 says it was meant: correcting a description without
   * touching the screenshots is a real thing to want.
   */
  if (total === 0 && !process.env.HTN_TEXT_ONLY) {
    console.error(
      "  There is no deck to upload, and uploading none would empty the store\n" +
        "  listing rather than leave it alone.\n\n" +
        "    npm run captures:ios      builds for a simulator and photographs it\n" +
        "    npm run captures:android  same, on an emulator\n" +
        "    npm run deck              composes both store decks from them\n\n" +
        "  HTN_TEXT_ONLY=1 writes the text and leaves the screenshots alone.\n",
    );
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { PLAY_LOCALE, LIMITS };
