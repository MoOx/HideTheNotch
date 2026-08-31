#!/usr/bin/env node
/**
 * Tags a version, which is how one gets published.
 *
 * The tag is the cause of a release, not a record of one. Both workflows fire
 * on `refs/tags/v*`, so pushing `v2.0.1` is what sends a build to TestFlight and
 * to the Play internal track, and the build that goes out is by construction the
 * commit that was tagged. Day to day builds keep their own way in, a `[testflight]`
 * or `[play]` marker in a commit message, and leave no tag behind: that is the
 * whole point, and the reason there is no tag written after an upload.
 *
 * So this is a gate rather than a convenience. It refuses four things, each of
 * which has shipped somewhere at some point:
 *
 *   a dirty tree          the commit built would not be the commit reviewed
 *   a tag already there   a version is published once
 *   an unread release note the store shows the previous version's text
 *   a version not bumped  two releases claiming to be the same one
 *
 * The release note is the interesting one. It lives in `marketing/listing.json`
 * as one string per locale, nothing reminds anyone to change it, and it goes out
 * unchanged unless someone does. Comparing it against the message of the last
 * tag is enough to catch that, and costs nothing.
 *
 *   npm run release           checks, writes the tag, prints the push command
 *   npm run release -- --push checks, writes it, pushes it, which starts a release
 */
const { execFileSync } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const git = (...args) => execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8" }).trim();

function stop(...lines) {
  console.error(`\n  ${lines.join("\n  ")}\n`);
  process.exit(1);
}

const version = require(path.join(ROOT, "app.json")).expo.version;
const tag = `v${version}`;
const note = require(path.join(ROOT, "marketing/listing.json")).locales["en-US"].release;

if (git("status", "--porcelain")) {
  stop(
    "The tree is not clean.",
    "",
    "The tag names a commit, the commit is what gets built, and the build",
    "carries its short SHA into every crash report. Commit or stash first.",
  );
}

const tags = git("tag", "--list", "v*").split("\n").filter(Boolean);
if (tags.includes(tag)) {
  stop(
    `${tag} already exists.`,
    "",
    "A published version is published once. Bump `expo.version` in app.json",
    "and write the release note that goes with it.",
  );
}

// The most recent one, by version rather than by date: tags are written here in
// order, but a fixup made out of order should not decide what "previous" means.
const previous = tags.sort((a, b) => compare(a.slice(1), b.slice(1))).at(-1);
if (previous) {
  if (compare(version, previous.slice(1)) <= 0) {
    stop(
      `app.json says ${version}, and ${previous} is already out.`,
      "",
      "The version has to go up before the tag can.",
    );
  }
  const before = git("tag", "-l", "--format=%(contents:subject)%0a%(contents:body)", previous)
    .replace(/\s+/g, " ")
    .trim();
  if (before && before === note.replace(/\s+/g, " ").trim()) {
    stop(
      `The release note is still the one that shipped with ${previous}.`,
      "",
      "It is `locales.en-US.release` in marketing/listing.json, and the other",
      "five locales beside it. The stores show it as What's New, so a version",
      "that changed nothing worth saying should probably not be a version.",
      "",
      "  npm run marketing:serve   then /listing, to read all six against their limits",
    );
  }
}

git("tag", "-a", tag, "-m", note);
console.log(`\n  ${tag} on ${git("rev-parse", "--short", "HEAD")}\n`);
console.log(`  ${note.split("\n")[0]}\n`);

if (process.argv.includes("--push")) {
  git("push", "origin", tag);
  console.log("  Pushed. Both workflows are starting.\n");
} else {
  console.log("  Nothing has left this machine. To release:\n");
  console.log(`    git push origin ${tag}\n`);
  console.log(`  To undo:\n\n    git tag -d ${tag}\n`);
}

/** Compares two dotted versions, numerically, field by field. */
function compare(a, b) {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) {
      return d;
    }
  }
  return 0;
}
