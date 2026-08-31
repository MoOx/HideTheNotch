# Seeing the deck: a workbench, and taking it to the next app

Three questions, asked together because they turn out to be the same question:
how do I open any capture without digging through directories, how do I edit
the deck and see it change, and how does all of this leave with me when the next
app needs a store listing.

The pipeline itself is in
[`2026-store-marketing-automation.md`](2026-store-marketing-automation.md).
This is about the tooling around it.

## 0. The short answers

- **A page listing every capture** is generated, never written: it reads the
  shot list from the app and the files from disk, so it can show a hole where a
  capture is missing instead of quietly omitting it.
- **The live deck is not a rewrite.** `compose.cjs` already produces one
  self-contained HTML document per shot and hands it to headless Chromium.
  Serve that same document instead of photographing it and the preview *is* the
  artwork, by construction. It is the same rule the app lives by: one drawing
  path, played twice.
- **Editing in the page is worth it for the copy and nothing else.** Words are
  what get iterated, six languages at a time, and a text editor cannot show you
  where a German headline wraps. Geometry belongs in the spec, where git is the
  undo.
- **Extraction is mostly not a code problem.** Four fifths of
  `tools/marketing/` is already app agnostic. What holds it to this app is three
  contracts that are currently implicit: how a capture run drives the app, what
  a deck spec is, and what a device is.
- **The thing that will actually hurt** is 100 MB of captures in git history,
  growing by another deck every time the interface moves.

## 1. Where it stands

| Fact | Number |
| ---- | ------ |
| Committed captures | 2 platforms x 6 languages x 4 states, 48 files, 100 MB |
| A composed deck | 5 shots x 6 locales x 2 stores, 60 renders |
| One shot, no capture in it | 1.9 s |
| One shot with a capture inlined | 2.4 s |
| The wallpapers, `screens.cjs` | 2 min 45 |
| `npm run deck`, everything | a little over five minutes |

Five minutes is the price of a one word change in one language, because
`compose.cjs` renders the whole matrix. `--only <id>` narrows it to one shot and
still renders six locales, which is how you find out that you were looking at
`fr` while iterating on `de`.

The seams that already exist are the ones this builds on: the deck is data
(`shots.json`), the device is a block inside it (`applyDevice`), the capture
language is a token in a path (`{lang}`), a missing capture has a `fallback`,
and `fingerprint.cjs` knows when the captures stopped showing this app.

## 2. A page to open every state

The question it has to answer, in one glance: *what does `03-home` look like on
Android in Japanese, and is it current?*

`tools/marketing/contact.cjs` writes `renders/marketing/index.html`, or the
server of section 3 serves the same page and lists at request time. It is
generated from what is on disk, and it is never committed.

- One row per state, one column per platform, one language at a time with a
  switcher that needs no round trip.
- The states come from the app's own list (`src/demo/shots.ts`, already compiled
  into `.harness/` by `build:harness`), not from the directory listing. A state
  the app has and the captures do not is then a hole with a name on it rather
  than a row that never existed.
- Every cell links to the file, and to the composed slot that used it.
- The header carries the fingerprint verdict per platform (current, drifted,
  never stamped), the capture date, and the weight.
- The composed decks are just more files on disk, so both stores go on the same
  page under the captures.

| Problem | Answer |
| ------- | ------ |
| 48 full size PNGs on one page is 100 MB | `loading="lazy"` and a constrained width is enough locally: the browser decodes what you scroll to. If it drags, cache 320 px thumbnails next to the page with CanvasKit, which the harness already carries. |
| The page lies the moment a capture is retaken | Generate on demand, list at request time when served, never commit the output. |
| iOS and Android captures are different sizes | A fixed row height and `object-fit: contain`, with the real pixel size printed under each. |
| `file://` or `http://` | Relative sources and an inline switcher work from a file. The moment the page wants to read the spec it needs the server, which is the same tool, so the page is written once and served by both. |

## 3. The deck, live

The fact that decides the design: `page(shot, deck, font)` returns a complete
HTML document, and `render()` does nothing but hand it to Chromium with a window
size. Everything needed for a live preview is already there; what is missing is
a way to look at it.

`tools/marketing/serve.cjs`, no dependencies, `node:http` and `fs.watch`:

| Route | What it serves |
| ----- | -------------- |
| `/` | the index: every shot, every locale, both stores |
| `/shot/:spec/:locale/:id` | `page()` verbatim, at store pixels |
| `/file/*` | captures, wallpapers, fonts, composed decks |
| `/render/:spec/:locale/:id` | shoots that one shot for real and returns the PNG |
| `/events` | server sent events, one line per change |

The index embeds each shot in an `<iframe>` of exactly 1320 x 2868 scaled by a
CSS transform. A transform does not reflow, so what is scaled down is the exact
layout that gets photographed, and browser zoom cannot move it either.

`fs.watch` on the specs, the captures, the fonts and the compositor itself
pushes one SSE line; the page reloads the iframes that care. Nothing renders
until you look at it, so a change costs a reload rather than five minutes.

What has to move in `compose.cjs`: export `page`, `applyDevice` and the
spec/locale merge, and put `main()` behind `require.main === module`. No logic
changes hands.

### The one seam, and keeping it to one

Screenshot mode inlines the captures and the font as `data:` URIs, because a
headless render is a single navigation with nothing behind it. Serve mode wants
URLs, or every reload re-encodes four megabytes per capture.

So `screenUri` and `fontFace` take an `asset()` from their caller: `dataUri`
when shooting, `/file/...` when serving. One function, one difference, named in
one place. Anything else that differs between the preview and the shot is a bug
by definition, and the same argument that keeps `draw.ts` single applies here:
a workbench that lies is worse than no workbench.

### Is what I see what I get

- Same engine, if the preview is opened in the Chromium the compositor shoots
  with. Another browser is another rasteriser and another font fallback.
- Same layout, because the page is in a fixed size frame and only transformed.
- Fonts are the real divergence. With the vendored `InterVariable.woff2` both
  are identical; without it, both fall back to the machine's sans, which at
  least fails the same way in both. The header should say which is in use,
  because "it looked right on my machine" is exactly the failure this invites.
- A **Shoot this one** button posts to `/render` and puts the real PNG beside
  the live page. That is the only proof, it costs 2.4 s, and it can be taken
  whenever a shot is about to be trusted.

### Three levels of editing, and where to stop

1. **Watch and reload.** Your editor stays the editor, the JSON stays the deck,
   the diff stays reviewable. This is most of the value and the least work.
2. **The copy, in the page.** `contentEditable` on the headline, the sub and the
   note, saving into `locales.<code>.copy.<id>`. This is the part a text editor
   is genuinely worse at: you cannot see a wrap until it is rendered, and six
   languages wrap in six places. Worth building, with a character count against
   the store's limit next to each field.
3. **Geometry by hand**, dragging the phone, sliders on scale, drop and tilt.
   Tempting, and I would leave it alone: those numbers are shared by every
   locale and every language, they are already tuned, and a slider is a way to
   change them by accident.

Write back, for level 2 only:

| Problem | Answer |
| ------- | ------ |
| The spec carries `"//"` comment keys and a hand ordered set of fields | Never rebuild the file from a fresh object. Read it, set one leaf, write it back with the same indentation, and prove on an untouched file that it round trips byte for byte before trusting it with a real edit. |
| Two writers, the page and your editor | Send the file's size and mtime with the save, refuse with 409 when they moved, and reload. |
| A save landing mid sentence | On blur and on an explicit key, never per keystroke. |
| The page quietly becoming where the deck lives | It never is. The file is the deck; the page is a text field on top of it. |
| Undo | Git. That is why the deck is a file in the repository. |

## 4. Taking it to the next app

### What is app specific, and what is not

| Piece | Reusable | What ties it here |
| ----- | -------- | ----------------- |
| `compose.cjs` | almost entirely | the default iPhone metrics, the cutout, the laurel seal |
| `serve.cjs`, `contact.cjs` | entirely | nothing, they are new |
| `shots.json` | no | it *is* the deck |
| `screens.cjs` | no | it drives this app's renderer to produce wallpapers |
| `capture-ios.sh`, `capture-android.sh` | apart from the contract | bundle id, the shot file names, `photo.jpg`, and the shot list grepped out of `src/demo/shots.ts` |
| `build-ios-sim.sh`, `build-android.sh` | any Expo app | the lintVital exclusion, the UIScene plugin |
| `create-avd.sh` | yes | the AVD name and the density this deck is composed against |
| `fingerprint.cjs` | yes | the `WATCHED` list |
| `stamp.sh`, `android-env.sh`, `probe-android.sh` | yes | nothing |

The reusable part is most of it. Three contracts hold the rest together, and
they are implicit today.

### Contract 1: how a capture run drives the app

Today, on iOS: write the state's id into `htn-shot.txt` in the app's container,
relaunch with `-AppleLanguages`, and wait for the app to write `htn-ready.txt`
when that state is on screen. It is a good contract. It is cheap, it is
explicit, and it makes the app say when it is ready instead of the script
guessing at a number.

Generalised, it needs three things a config can name:

- **The prefix**, so the two files are the app's own.
- **How a state is reached**: a file plus a relaunch, or a deep link
  (`simctl openurl`, `am start -d`), which most apps already have.
- **How readiness is decided**: `file` (the app says so), `settle` (shoot every
  300 ms until two frames are identical), or `delay`. `settle` is slower and
  blind to a looping animation, and it needs nothing at all in the app, which
  matters for an app that will not carry marketing code in its source.

The shot list has to leave the app source too: `grep -o 'id: "..."'` over
`src/demo/shots.ts` works because this app's demo script doubles as the capture
list. In the config it is a list of ids, and an app with such a module points at
it.

### Contract 2: the deck spec

Already data, and it wants three additions: a `version` the tool can refuse or
migrate, a `device` named from a catalogue rather than spelled out in metrics,
and the locale table made explicit instead of implied by directory names,
because the three spellings genuinely differ:

| The app says | App Store | Play |
| ------------ | --------- | ---- |
| `fr` | `fr-FR` | `fr-FR` |
| `ja` | `ja` | `ja-JP` |
| `zh-Hans` | `zh-Hans` | `zh-CN` |

That table belongs to the tool, not to the app.

### Contract 3: what a device is

Shot size, cutout shape and position, screen radius, bezel, rim. Those are
properties of a phone, so they belong to the tool as a catalogue:
`iphone-6.9`, `ipad-13`, `pixel-1080x2400`. This app is unusual in that the
cutout is the product; every other app wants a bezel and nothing inside it,
which is the same data with `cutout: "none"`.

### One config file

`store-deck.config.cjs` at the app root, holding what the scripts currently
learn from a mix of constants, env vars and greps: bundle and package ids, the
scheme, the languages, the capture prefix and readiness mode, where captures and
renders live, the fingerprint globs, the commands to run before composing
(`screens.cjs` is one of those), and the deck specs. The `HTN_*` variables stay
as per run overrides.

### How to ship it

| Option | For | Against |
| ------ | --- | ------- |
| npm package | one pinned version per app, `npx`, a real artefact | a publish for every fix you make while using it |
| git dependency, `github:MoOx/store-deck#v2` | no registry, pinned per app | npm still resolves a tarball, so local iteration means `npm link` |
| submodule | exact pin, no packaging | detached heads, forgotten updates, `--recursive` in every checkout |
| copy the template and diverge | no infrastructure, and it is what `fastlane/` already does here | three copies, and the fix lands in one |

A git dependency first, npm only if someone else ever uses it. Per app files
(the spec, the config, the assets, the wallpaper producer) stay in the app; the
scripts live in the package. The rule already written in `CLAUDE.md` for
`fastlane/` applies unchanged: fix it upstream rather than diverging locally.

**Order matters.** Build the workbench here, in this repository, and extract
afterwards. The seams show themselves when the second app arrives, and guessing
them now is how a package ends up with an abstraction nobody needed. The only
discipline required in the meantime is to add no new coupling: nothing in the
compositor should learn anything new about this app.

## 5. The problems that are not about code

- **100 MB of captures in history**, growing by a deck every time the interface
  moves. In the order I would try them: lossless recompression at capture time
  (`oxipng`, and verify the decoded pixels are unchanged, the cutout above all);
  a lossless intermediate format (WebP lossless is 40 to 60 % smaller and
  Chromium reads it natively, but CanvasKit's encoder is the lossy one, so it
  would have to come from the capture side and be checked pixel for pixel); or
  moving the captures out of the repository, at the cost of the "no Mac needed"
  property being one clone deeper. What I would not do is stop committing them:
  that trade was made for a good reason.
- **Fonts.** Inter is OFL and can be vendored. Anything else has to be cleared
  before it goes into a package other apps clone.
- **Chromium.** The lookup is a list of paths. In a package it wants
  `CHROME_PATH`, then the system browsers, then an error naming
  `npx playwright install chromium`. Never a silent 150 MB download.
- **Store rules rot.** Sizes, slot names, preview lengths: one dated file in the
  package, so they can be rechecked instead of trusted.
- **CI.** Composing on Ubuntu is free and quick; capturing needs a Mac runner
  and an emulator. Keep captures manual and composition automatic, which is what
  the existing split already says.

## 6. Staging

| Phase | Work | Effort |
| ----- | ---- | ------ |
| 1 | export `page()`, `serve.cjs` with SSE and the scaled iframe index | half a day |
| 2 | the contact sheet, generated and served by the same tool | half a day |
| 3 | copy editing in the page, write back with a 409 guard, character counts | one day |
| 4 | `store-deck.config.cjs`, the device catalogue, the locale table, the readiness modes | one day |
| 5 | extract to its own repository, install as a git dependency | one to two days |

Phases 1 and 2 pay for themselves the first afternoon they exist. Phase 5 should
wait for the second app.

## 7. What not to build

- **A general editor.** The spec is small, it is a file, and git is the undo.
- **Pixel goldens across machines.** Font rasterisation differs between them.
  Compare the generated HTML, and assert the few pixels that carry meaning.
- **A design tool in the loop.** The whole point is that the artwork comes out
  of the app's own code.
- **A second renderer for the preview.** The moment the preview draws something
  the shot does not, the workbench is lying.
