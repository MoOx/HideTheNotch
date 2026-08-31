# Automating the store deck: screenshots, 3D renders, preview video

_August 2026. A study, not a work list. It answers four questions: what fastlane
can do today, whether it can tilt a device, how we would get real 3D renders and
a usage video, and what the store listings should actually say. A working
prototype of the screenshot half lives in `tools/marketing/`._

---

## 0. The short answers

1. **fastlane cannot tilt a device.** `frameit` composites a flat 2D bezel with
   ImageMagick. It has orientation (portrait, landscape left, landscape right)
   and nothing else: no perspective, no angle, no camera. That is by design, and
   it has not changed since 2017.
2. **3D is ours to render**, and the cheapest good option is a headless Chromium
   page with a CSS 3D transform, which is a real perspective projection. It runs
   on a free ubuntu runner, in seconds, with no binary dependency. Prototype
   below, it works.
3. **A preview video is fully automatable**, but not by fastlane's capture
   tools: Maestro drives the app, `simctl` records, `ffmpeg` conforms the file,
   and `deliver` uploads it. Uploading App Previews is the one genuinely new
   fastlane feature that matters to us.
4. **The tilt hides our own feature.** Everything this app sells happens in the
   top 60 points of a screen, and a phone at 17 degrees foreshortens exactly
   that. So the first two slots stay flat and 1:1, and the tilt is decoration
   from slot 3 onwards.

---

## 1. What v1 had, and why it is not a starting point

`origin/main` still carries the 2017 setup:

```
ios/fastlane/Snapfile                       iPhone X, iPhone 8 Plus, iPad Pro 12.9
ios/fastlane/SnapshotHelper.swift           vendored, version 2.64.0 era
ios/fastlane/screenshots/Framefile.json     3 filters, a title font, a background
ios/fastlane/screenshots/en-US/title.strings
```

with `snapshot` and `frameit` commented out inside the `release` lane. It is the
output of `fastlane init` plus three titles. Two of the three device sizes it
targets no longer exist as store slots, `SnapshotHelper.swift` has to be
re-vendored per fastlane version, and the whole thing sits under `ios/`, which
v2 regenerates from scratch on every build (`expo prebuild --clean`). Nothing
there is worth porting. The ideas (framed screenshots, per locale titles, one
file per slot) are worth keeping.

## 2. What the stores require, August 2026

Apple's rules got **much** cheaper since 2017: one size per family, scaled down
by App Store Connect.

| Slot | Size | Required |
| ---- | ---- | -------- |
| iPhone 6.9" | 1320 x 2868 | yes, the app runs on iPhone |
| iPhone 6.5" | 1284 x 2778 | only if 6.9" is missing |
| iPhone 6.3" and 6.1" | 1179 x 2556, 1170 x 2532 | no, scaled from 6.5" |
| iPad 13" | 2064 x 2752 | **yes**, see below |

1 to 10 per locale, PNG or JPEG, **no alpha channel**.

The iPad line is not optional for us: `app.json` keeps `supportsTablet: true`
because Apple refuses an update that drops a device family (error `90101`, see
the README), so the app record needs iPad screenshots. That is a second deck, at
a different aspect ratio, and it is the single biggest cost in the whole plan.

App Previews, per Apple's own specification page:

| Item | Value |
| ---- | ----- |
| iPhone, every size from 5.8" up | 886 x 1920 portrait (1920 x 886 landscape) |
| iPad 13" | 1200 x 1600 |
| Duration | 15 to 30 seconds, hard limits |
| Frame rate | 30 fps maximum |
| Codec | H.264 High profile level 4.0, 10 to 12 Mbps, or ProRes 422 HQ |
| Audio | stereo, AAC 256 kbps or higher |
| Poster frame | 5 seconds by default, settable |
| Count | up to 3 per locale |
| Size | 500 MB maximum |

Note that 886 x 1920 is **not** a scaled 1320 x 2868 (2.1673 against 2.1727), so
the conform step is a scale plus a 6 pixel crop, not a plain resize.

Google Play, for comparison: 2 to 8 phone screenshots, JPEG or 24 bit PNG with
no alpha, between 320 and 3840 pixels a side, longest side at most twice the
shortest, 8 MB each. Four screenshots at 1080 x 1920 or better is the threshold
to be eligible for the recommendation surfaces. **Play takes no video file at
all**: the promo video is a YouTube URL, which means publishing the same MP4 to
YouTube and storing the link.

## 3. What fastlane actually does today (2.238.0)

### deliver, and the one real novelty

`deliver` moved to the App Store Connect API years ago, so the whole metadata
and screenshot path runs off the API key we already decrypt from the
certificates repository. No Apple ID, no session, no 2FA prompt.

New and directly useful: **it uploads App Previews**. Three options drive it:

| Option | Default | What it does |
| ------ | ------- | ------------ |
| `app_previews_path` | none | folder holding `<locale>/*.{mp4,mov,m4v}` |
| `preview_frame_time_code` | `00:00:05:00` | the still frame shown before play |
| `overwrite_preview_videos` | `false` | wipe the existing previews first |

The rules it enforces locally, before touching the network (read from
`deliver/lib/deliver/sync_app_previews.rb`):

- the **device type comes from the filename**, as a token: `IPHONE_67` is the
  6.9" slot, `IPHONE_65` the 6.5", `IPAD_PRO_3GEN_129` the 13" iPad. A file with
  no recognised token is skipped with a warning, not an error;
- at most 3 per locale and per type, sorted by filename;
- duration outside 15 to 30 seconds: skipped. Resolution not exactly canonical:
  skipped. Both are read by a pure Ruby MP4 and MOV atom parser, so there is no
  ffprobe dependency, and both failures are **warnings**, which means a
  malformed file silently does not ship;
- already uploaded files are detected by MD5 and skipped, so the lane is
  idempotent.

Screenshots, by contrast, are matched **by resolution**: 1320 x 2868 is
recognised as the 6.9" slot whatever the file is called. Filenames only decide
order. Also worth knowing: `overwrite_screenshots: true` on the first run, since
the app record still holds the 2017 screenshots on slots that no longer exist,
and `sync_screenshots: true` (beta, needs
`FASTLANE_ENABLE_BETA_DELIVER_SYNC_SCREENSHOTS=1`) which diffs instead of
deleting and re-uploading everything.

`precheck` reads the metadata for the things Apple rejects on sight (mentions of
other platforms, placeholder text, prices in the description). Cheap, worth
having in the lane.

### frameit: flat, and staying flat

Frames come from `fastlane/frameit-frames`, ImageMagick composites them, and the
Framefile gives title, keyword, background, padding, font and colour. The only
geometric control is `force_orientation_block`, which picks between portrait,
`landscape_left` and `landscape_right`. **There is no rotation angle, no
perspective, no camera, no shadow control.** Requests for it are old and closed.

That is not a gap to work around inside frameit. A framed screenshot is a
composite of a picture and a bezel; a tilted phone is a rendering problem.

### snapshot: unchanged, and awkward with Expo

`capture_ios_screenshots` still means an XCUITest target plus a vendored
`SnapshotHelper.swift`. Our `ios/` directory is generated by
`expo prebuild --clean` on every build and is not tracked, so that target would
have to be re-created by an Expo config plugin on each prebuild. That is real
work (an `xcodeproj` manipulation plugin), it breaks whenever Expo changes its
template, and it buys us only the screenshots, not the video.

`screengrab` on the Android side has the same shape with an instrumentation
test.

### supply, for Play

Reads a metadata tree: `<locale>/images/phoneScreenshots/*.png`,
`featureGraphic`, `icon`, and a `video` field that holds a YouTube URL. It
checksums images and skips unchanged ones. The Android lane in our `Fastfile`
currently sets every `skip_upload_*` to true, so turning the listing on is a
matter of flipping four flags once the assets exist.

## 4. Getting 3D: the options

| Approach | What it gives | What it costs |
| -------- | ------------- | ------------- |
| **CSS 3D in headless Chromium** | true perspective projection of a flat screen, gradients, blend modes, web fonts, per locale text, all scripted | the bezel and the highlights are drawn by hand, no reflections, no curved glass edge |
| three.js in the same headless Chromium | a real model, environment reflections, soft shadows, depth of field | one npm dependency, a phone model with a licence that allows commercial use, WebGL under SwiftShader on CI |
| Blender headless (`bpy` as a pip module) | photoreal, path traced | a 300 MB dependency, minutes per frame, a `.blend` nobody can review in a pull request |
| Rotato, Mockly, Previewed and similar | the best quality per minute of work | a human clicking, which is the thing we are removing, and a subscription |

**Recommended: CSS 3D**, with three.js held in reserve if we ever want a
reflection of a window on the glass. The prototype in `tools/marketing/` proves
the geometry is right: a `perspective(3400px) rotateY(-17deg)` on a flat plane
is exactly the homography a camera would produce, so nothing about the tilt
looks wrong. What a browser cannot fake is light: the metal rim is a hand
authored gradient, and it reads as a good drawing rather than as a photograph.
For an app whose product is a flat rectangle of pixels, that is enough.

### The argument against using it much

Look at slot 3 of the prototype (`03_..._families.png`, a phone at 17 degrees)
next to slot 2 (`02_..._before-after.png`, flat, split down the middle). The
tilted one is prettier. The flat one is the only one that **sells anything**:
the whole product is a 37 point tall pill at the top of the screen becoming
invisible, and at 17 degrees that pill is 30 percent shorter, partly in shadow,
and reads as a bezel. Worse, a tilted phone is a claim about hardware, and a
reviewer who cannot see the effect cannot verify the claim.

So the deck should be: **slots 1 and 2 flat, at 1:1, no crop**, because that is
where the proof is, and tilted renders from slot 3 onwards, plus the Play
feature graphic (1024 x 500) and the website, where the job is to be pretty.

## 5. Getting the real app on screen, and the video

Everything above composites *captures*. Two kinds are needed, and only one of
them needs a device.

**The wallpaper itself needs nothing.** `tools/marketing/screens.cjs` renders it
with the app's own `drawRecipe` against CanvasKit, at 1320 x 2868, in about a
second, on any machine. Same trick as `npm run samples`, same guarantee: the
black in a store screenshot is produced by the shader that produces the black on
the phone, so the marketing cannot drift from the product.

**The app's interface does need a simulator**, because it is real SwiftUI
(`@expo/ui`, `expo-glass-effect`). Two ways:

| | fastlane snapshot | Maestro plus simctl |
| - | ----------------- | ------------------- |
| Native target | an XCUITest target, re-created by a config plugin on every `expo prebuild` | none |
| Flows | Swift | YAML |
| Android | a second, different setup (`screengrab`) | the same flow file |
| Video | not supported | the same flow, recorded |
| Failure mode | Xcode template drift | selector drift |

**Maestro wins**, mostly because one flow file produces both the screenshots and
the video, and because nothing has to survive a prebuild.

```yaml
# tools/marketing/flows/03-editor.yaml
appId: io.moox.HideTheNotch
---
- launchApp:
    arguments:
      demo: true          # forces a known recipe and a known target device
- tapOn: "Fade"
- swipe: { from: { x: 92%, y: 60% }, to: { x: 92%, y: 35% } }
- takeScreenshot: 03-editor
```

The `demo` launch argument is the part worth designing properly: it forces a
known recipe, so a capture does not depend on whatever the app was last left in.

> The rest of this paragraph proposed forcing a geometry too, from a picker in
> the save sheet. That picker was never built and will not be: the deck names
> the simulator it is shot on (`iPhone 17 Pro Max`), and the emulator is given a
> real punch hole through an AOSP overlay. The pixels come from a screen that
> genuinely has that shape.

Capture and record:

```sh
xcrun simctl io booted screenshot --type=png capture.png    # native pixels
xcrun simctl io booted recordVideo --codec h264 raw.mov     # until SIGINT
```

Conforming to Apple's preview spec, including the 6 pixel crop and the silent
stereo track that the specification asks for:

```sh
ffmpeg -i raw.mov -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 \
  -map 0:v -map 1:a -t 24 \
  -vf "fps=30,scale=886:-2:flags=lanczos,crop=886:1920" \
  -c:v libx264 -profile:v high -level 4.0 -b:v 11M -maxrate 12M -bufsize 24M \
  -pix_fmt yuv420p -c:a aac -b:a 256k -movflags +faststart \
  fastlane/previews/en-US/01_IPHONE_67_hide.mp4
```

then `preview_frame_time_code: "00:00:03:00"` so the poster frame lands after
the wipe rather than on a blank home screen.

**What the video should show**, in 24 seconds: a photo picked from the library,
the fade appearing under the island, the slider moving so the fade grows and
shrinks, the export, and the wallpaper set, ending on the home screen with the
island gone. No narration, no title cards: Apple rejects previews that are
mostly marketing animation, and the app is legible without commentary.

For Play, the same MP4 goes to YouTube and the URL goes into
`fastlane/metadata/android/en-US/video.txt`.

## 6. Proposed layout

```
tools/marketing/
  screens.cjs        wallpaper captures, from the app's own renderer      (done)
  compose.cjs        HTML and CSS 3D compositor, to store pixels          (done)
  shots.json         the deck as data, per locale                         (done)
  captures/          device captures, git ignored, 150 MB of them          (done)
  flows/*.yaml       Maestro flows, one per capture, one for the video    (todo)
fastlane/
  metadata/          App Store text, per locale, one file per field
  metadata/android/  supply's tree, images and video.txt
  screenshots/       composed, generated, git ignored
  previews/          conformed MP4s, generated, git ignored
```

The split that matters: **the captures are one artefact and the deck is
another**, and neither is committed. Recomposing the deck (new copy, new colour,
a fifth locale) needs no Mac and no simulator, runs in seconds, and shows up as
a reviewable diff of `shots.json`. Re-capturing only happens when the app's
interface actually changes, and the fingerprint beside the captures is what says
when it has.

> Written when the plan was to commit the captures, at "a few MB". They came out
> at a hundred and fifty, so they are git ignored like everything else the
> pipeline produces. What survives in the repository is the two specs and the
> listing, which are the parts worth reviewing as a diff.

Lanes:

```
fastlane ios screenshots   # maestro, simctl, compose, write into fastlane/screenshots
fastlane ios preview       # maestro, recordVideo, ffmpeg conform
fastlane ios metadata      # deliver: text, screenshots, previews, precheck. No binary.
fastlane android metadata  # supply, with the four skip_upload_* flipped
```

Keeping `metadata` separate from `beta` matters: the listing should be
updatable without shipping a build, and a build should never be blocked by a
typo in a description.

CI: a `store-assets.yml` on ubuntu recomposing the deck on every change to
`tools/marketing/` and uploading it as an artifact, so a copy change can be
judged from the Actions tab. The macOS capture job stays manual.

## 7. What the listing should say

The product has three things worth saying, in this order: it works, it is free
with no advertising and no account, and it collects nothing. The last one is
unusually strong here and it is **verifiable**: the app makes no network request
at all, which is a claim very few utilities can make.

Where each surface carries it:

| Surface | Content |
| ------- | ------- |
| Subtitle (30 chars) | `Hide the notch, free, no ads` (28) |
| Promotional text (170) | the one line pitch, changeable without a review |
| Description, first 3 lines | what it does, then free and no ads, then no data |
| Privacy nutrition label | Data Not Collected, every category |
| Play Data safety | no data collected, no data shared |
| Play "contains ads" | declared false, so no badge appears |
| In-app purchases | none, so no badge appears next to Get |
| Slot 1 badges | Free, No ads, No account |

Two notes on tone. Repeating "free, no ads" on all five screenshots reads as
defensive; once on slot 1, plus the two badges Apple and Google draw themselves,
is stronger. And the open source repository is worth naming in the description:
for this kind of utility it is the proof behind "collects nothing".

Proposed five slots, iPhone:

1. **the app itself**, editor visible, the fade under the island, headline
   `The notch, disappears.`, badges Free / No ads / No account
2. **before and after**, one photo, split down the middle, flat and 1:1
3. **the three families**, tilted, `Solid bar, decaying stripes, dithered fade.`
4. **the editor**, tilted, gradient points being moved, or a photo from the
   library
5. **the result**, full bleed wallpaper, caption on export at native resolution

Slots 1 and 4 show the real interface, which is what App Review guideline 2.3.3
asks for: screenshots have to show the app in use, and a deck made only of
wallpapers would be a deck of results with no app in it. The prototype below
currently has zero app interface, because capturing it needs the simulator step.

## 8. The prototype, and what it proves

```sh
npm run build:harness
node tools/marketing/screens.cjs                      # 5 captures, 1320 x 2868
node tools/marketing/compose.cjs                      # the deck, per locale
node tools/marketing/compose.cjs --font Inter.woff2   # with a real typeface
```

Output lands in `renders/marketing/`, which is git ignored like the rest of
`renders/`. Six files, two locales, four layouts (`full`, `flat`, `tilt`,
`tilt-right`), roughly two seconds for the lot.

What it establishes:

- the geometry is right. The Dynamic Island is drawn as an absolute `#000000`
  pill at the exact place the hardware puts it, 125 x 37.33 points at 11 points
  from the top edge, taken from `src/geometry/devices.ts`. Over the unmasked
  wallpaper it reads as a hole, over the masked one it stops existing. That
  single image is the entire product, and it is generated, not retouched;
- CSS 3D is convincing enough at this scale;
- per locale copy in a JSON file is the right granularity: `fr-FR` is one entry
  and no new code.

What it does not do yet, in order of cost: the app's own interface (needs the
Maestro plus simctl step), the iPad deck at 2064 x 2752, the video, the Play
feature graphic, and the upload lane itself.

## 9. Staging

| Phase | Work | Effort |
| ----- | ---- | ------ |
| 0 | metadata as files, `ios metadata` lane, `precheck`, upload the existing text | half a day |
| 1 | the compositor as it stands, real copy, iPhone deck, en and fr | one day |
| 2 | Maestro flows, demo launch argument, macOS capture job, real interface in slots 1 and 4 | one to two days |
| 3 | the iPad deck (same pipeline, second aspect ratio) | half a day |
| 4 | the preview video, conform, upload, poster frame | one to two days |
| 5 | Play listing, feature graphic, YouTube link | half a day |

Phase 2 is the one that can go wrong, and it is the one everything else waits
on. Everything before it needs no Mac.

## 10. Risks

- **Guideline 2.3.3**: a deck of wallpapers with no interface invites a
  rejection. Fixed by phase 2, so do not ship phases 0 and 1 to review as the
  final deck.
- **iPad is mandatory** while `supportsTablet` stays true, and it stays true
  while the 2017 app record is being updated.
- **Silent skips in deliver**: a preview that is 31 seconds long, or 887 pixels
  wide, is skipped with a warning and the lane still succeeds. The lane should
  fail on a missing preview rather than trust the output.
- **Frames are ours, not Apple's**: drawing our own generic phone avoids Apple's
  product image rules entirely. It must stay generic: no logo, no product name,
  and no claim that a specific model is pictured.
- **Fonts**: whatever typeface the deck uses has to be embeddable and
  redistributable. Inter (OFL) is the obvious default and is what the prototype
  was rendered with.
- **Old screenshots on the app record**: the 2017 listing still holds images on
  slots that no longer exist. First upload with `overwrite_screenshots: true`.

## Sources

- Apple, [App preview specifications](https://developer.apple.com/help/app-store-connect/reference/app-preview-specifications/)
- Apple, [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/)
- fastlane source, `deliver/lib/deliver/sync_app_previews.rb`, `deliver/lib/deliver/options.rb`,
  `spaceship/lib/spaceship/connect_api/models/app_preview_set.rb`, `supply/lib/supply.rb` (2.238.0)
- fastlane docs, [frameit](https://docs.fastlane.tools/actions/frameit/), [upload_to_app_store](https://docs.fastlane.tools/actions/upload_to_app_store/)
- [Maestro documentation](https://docs.maestro.dev/get-started/quickstart)
- Google, [Add preview assets to showcase your app](https://support.google.com/googleplay/android-developer/answer/9866151)

## 11. The tip jar, and what the listing has to say about it

Not built yet, and noted here so the listing copy does not have to be rewritten
when it is. The plan, in the order the user meets it:

1. Two successful exports, counted in storage.
2. `StoreReview.requestReview()` on the second one, which is the moment the app
   has just done the thing it exists for.
3. A tip jar of three consumable amounts, somewhere calm, **unconditionally**.

Step 3 said "only if a rating was given" until somebody went to build it. **That
signal does not exist.** Both review APIs are deliberately opaque: you ask, the
system decides whether to show anything at all, and nothing comes back. Apple's
`SKStoreReviewController` reports neither whether the sheet appeared nor what
was tapped, and caps the prompt at three times per year per device; Google's
In-App Review says in as many words that the API does not indicate whether the
flow was displayed or whether the user reviewed.

And the obvious workaround, asking "do you like the app?" first and only
prompting the ones who say yes, is against the rules rather than merely
unavailable: Apple forbids filtering users by sentiment before the system
prompt, precisely because it is what makes store ratings meaningless.

So the two are independent. The rating is asked for once, at a good moment, and
forgotten. The tip stands on its own.

Nothing is ever locked behind it. It buys the author a coffee and the user
nothing, which is the whole point and also the reason it can be offered without
souring the app.

**The listing has to say so, because both stores will contradict it otherwise.**
An app with any in-app purchase carries a badge: "In-App Purchases" on the App
Store, "Contains in-app purchases" on Play. A listing that says "free" next to a
badge that says "purchases" reads as a trick, and the reader does not stop to
work out which is true. So the deck states it plainly, in the same breath as the
free: a tip is optional, it unlocks nothing, and there is nothing else to buy.
The word to avoid is "premium", in every language.
