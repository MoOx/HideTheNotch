# Demo mode, the tutorial question, and the app in a browser

_August 2026. Follows `2026-store-marketing-automation.md`, which left five
things undone. This answers three questions: what to do about them, whether a
first run tutorial is worth building, and what an Expo web build of this app
actually gives. The web part is a measured spike, not an opinion._

---

## 1. One idea removes most of the remaining work

The store study assumed the App Preview video would be produced the usual way:
a UI automation tool taps through the app while a screen recorder runs. That is
the standard answer, and here it is the wrong one, because of something this
app has and most apps do not.

**A recipe is serialisable JSON, and the entire screen is a pure function of
it.** So a demo does not need anything to tap: it is a timeline of recipes,
played into the same state the interface writes to.

Built, in three files:

```
src/demo/script.ts     the storyboard, as data: 25 steps, 22 seconds
src/demo/useDemo.ts    the player: owns the clock and the finger, knows no masks
src/ui/DemoFinger.tsx  the touch being pretended
```

```ts
export type DemoStep =
  | { kind: "hold"; ms: number }
  | { kind: "param"; to: number; ms: number }
  | { kind: "family"; to: MaskFamily; ms: number }
  | { kind: "palette"; to: GradientPresetId; ms: number }
  | { kind: "sheet"; to: DemoSheet; ms: number }
  | { kind: "peek"; on: boolean; ms: number };
```

Durations are relative rather than absolute timestamps: a timeline of absolute
times reads better in a document and renumbers itself every time a beat is
inserted, which is the wrong trade for a file meant to be edited.

The player only ever calls the setters the interface itself calls, so the demo
cannot show a state the app cannot reach. Two consequences worth naming: the
finger's vertical travel is computed from `PARAM_TRAVEL`, the app's own gesture
constant, so it cannot mime a drag the app would refuse; and no finger is drawn
over the native sheets, whose geometry is not ours to guess.

That one file then feeds four things:

| Consumer | What it uses |
| -------- | ------------ |
| App Preview video | the app plays the script, `simctl` records, nothing drives it |
| Store screenshots | the same script, paused at named beats, captured by `simctl io screenshot` |
| Web demo hero | the same script, autoplaying in a browser |
| First run demo, if we keep it | the same script, truncated, aborted on the first touch |
| The "Watch the demo" row | the export sheet, for anyone who wants to see it again |

Compared to driving the app from outside, it is **deterministic** (the same run
produces the same frames, so a re-record is a re-record and not a re-shoot), it
has no selectors to break, and it needs no Maestro on the critical path. Maestro
stays useful for one thing only: proving the built app still launches and
responds to real taps, which is a test concern, not a marketing one.

Two things the script has to carry that a human hand carries for free:

- **a touch indicator.** A self playing app with no finger visible reads as a
  video of a video. Draw a soft circle at the gesture position while the script
  runs, the way Maestro does on its own iOS recordings. Demo mode only;
- **the sheets.** Import and export open native sheets, so the script has to
  open them the same way the buttons do, which means the demo state has to
  include which sheet is presented. That is one field, and it is already
  implied by the interface.

### The remaining work, reordered

| | Work | Needs a Mac | Effort |
| - | ---- | ----------- | ------ |
| 1 | `src/demo/script.ts`, the player, the touch indicator, the triggers | no | **done** |
| 2 | metadata as files, `ios metadata` lane, `precheck` | no | half a day |
| 3 | screenshots: play the script, capture at beats, compose the deck | yes, once | half a day |
| 4 | the video: record the script, conform with ffmpeg, upload | yes | one day |
| 5 | iPad deck, same pipeline at 2064 x 2752 | yes | half a day |
| 6 | Play listing, feature graphic, YouTube | no | half a day |
| 7 | web build, if we want it (section 3) | no | one to two days |

Step 1 is the keystone rather than the simulator work, and it runs on any
machine. That is the whole point of the reordering, and it is done.

**How it is started.** Three ways, one path: the "Watch the demo" row in the
export sheet, a first run play if we ever want one, and

```sh
xcrun simctl openurl booted hidethenotch://demo
```

which plays it on a release build. So the capture pipeline needs no debug flag,
no environment variable baked at bundle time, and no separate binary: the build
that ships is the build that gets recorded.

**How it stops.** The first touch, spent doing it rather than passed on: an app
that hands control back mid animation and then keeps moving is worse than one
tap. Every deliberate action does the same, so a tap on a corner button or a row
in a sheet ends the demonstration rather than fighting it.

`npm run verify` now also checks the script stays inside Apple's 15 to 30 second
window. It is not a pixel, but it is the same kind of property: `deliver` skips
an out of range App Preview with a warning **and still reports success**, so a
script edited past the edge would be found out at the store rather than here.

## 2. The tutorial: no, and here is what instead

The instinct is right. An overlay on first launch with arrows and a "Got it"
button is the most dated thing that can be put in a portfolio app, and it
usually means the interface lost an argument with itself.

More specifically, look at what a tutorial would teach here:

| Gesture | Already visible? |
| ------- | ---------------- |
| Swipe left and right, change family | yes, `FamilyDots` is a page indicator, and the families are also rows in the wallpaper sheet |
| Swipe up and down, change the setting | yes, `VSlider` shows the same value and moves with it |
| Import button | yes, a corner button |
| Export button | yes, a corner button |
| **Long press, peek at the unmasked wallpaper** | **no affordance at all** |
| **Shake, support sheet** | no, deliberately, it is an easter egg |

So a tutorial for the four things listed in the question would teach shortcuts
for controls that are already on screen. The one gesture with no affordance is
the long press peek, and it is also the one a tutorial would struggle to make
look like anything.

**What to do instead**: the app demonstrates itself, once, for about three
seconds, using the script from section 1. No overlay, no chrome, no button to
dismiss: the value moves, the family pages once, the existing `Caption` names
what changed, and the first touch cancels it for good. It teaches by doing the
thing rather than by describing it, which is also the only kind of onboarding
that survives being watched twice.

Conditions, so it does not become the thing you wanted to avoid:

- it plays **once ever**, persisted, and never again;
- **any touch aborts it immediately**, mid animation, and hands back control at
  the state it had reached, not at the state it started from;
- it does not touch the sheets. Opening a sheet at the user in the first three
  seconds is an interruption, whatever it contains. The sheets belong in the
  video, not in the first run;
- it is one flag. If it feels wrong on a device, it costs nothing to remove.

And the real reason to build it even if it never ships to users: **you need the
script anyway for the video.** Shipping it to first run is then a decision you
can take by feel, on a real device, in the time it takes to flip a boolean.

### The video storyboard, which is what the question actually described

The sequence in the question (swipe across, swipe up and down, import sheet,
export sheet) is a poor tutorial and an excellent App Preview. It is the whole
app in the order someone would use it, it fits in 15 to 30 seconds, and it ends
on the only thing worth ending on: the wallpaper set on a home screen with the
island gone. Keep it, but as the video script.

## 3. The web build: measured, not guessed

The question was what `@expo/ui` gives on the web. The answer is better than
expected, and the walls are elsewhere.

**`@expo/ui` universal components ship a real web implementation.** The package
uses the platform extension convention in the direction people forget:
`index.ios.tsx` and `index.android.tsx` are the native ones, and the unsuffixed
`index.tsx` **is the web one**. `Slider` there is an `<input type="range">`
styled with CSS variables, and the package carries a full web theme
(`src/universal/webUtils.ts`: light and dark palettes, an OKLCH derived primary
scale, focus shadows). `BottomSheet`, `FieldGroup`, `ListItem` and `Text`, which
is exactly what `src/ui/sheets.tsx` uses, are all in that layer.

What is native only: `@expo/ui/swift-ui` and `@expo/ui/jetpack-compose`, which
is fair, and `expo-glass-effect`, which `src/ui/Glass.tsx` already falls back
from.

### What the spike did

`npm i --no-save react-dom react-native-web`, then
`npx expo export --platform web`, then the bundle served and opened in headless
Chromium, with an error trap in the page. It bundles on the first try: **1384
modules, 2.6 MB of JavaScript**, and Metro pulls the Material Symbols font
(962 kB) because `expo-symbols` has an Android and web path through it, so the
icons are not even a problem.

Then it fails at runtime, four times, each time on one line:

| Failure | Cause | Fix |
| ------- | ----- | --- |
| `Cannot read properties of undefined (reading 'RuntimeEffect')` | `src/render/shaders.ts` compiles both runtime effects at module load, and `Skia` does not exist until CanvasKit is fetched | load CanvasKit first, then require the app, in `index.ts` |
| `Cannot find native module 'ExpoMediaLibraryNext'` | `src/render/export.ts` imports `expo-media-library`, which has no web module | a `src/render/export.web.ts` that hands the PNG to the browser as a blob |
| `Cannot find native module 'ExpoUI'` | `src/ui/sheets.tsx` imports `@expo/ui/swift-ui/modifiers` at the top of the file for one cosmetic margin, and that module calls `requireNativeModule('ExpoUI')` at import time | require it lazily, inside the `Platform.OS === "ios"` branch that already guards its use |
| `this._nativeModule.addListener is not a function` | `expo-sensors` has a web build whose accelerometer is a stub | return early from `useShake` on web |

None of them is deep. Three are one line, one is a 40 line file. The bootstrap:

```ts
// index.ts
import { registerRootComponent } from "expo";
import { Platform } from "react-native";

if (Platform.OS === "web") {
  const { LoadSkiaWeb } = require("@shopify/react-native-skia/lib/module/web");
  LoadSkiaWeb({ locateFile: (f: string) => `/${f}` }).then(() => {
    registerRootComponent(require("./App").default);
  });
} else {
  registerRootComponent(require("./App").default);
}
```

with `canvaskit.wasm` copied from `node_modules/canvaskit-wasm/bin/full/` into
`public/`, which `expo export --platform web` does pick up. The lazy modifier
import wants a typed require to keep `npm run typecheck` green:

```ts
const TIGHT: ModifierConfig[] =
  Platform.OS === "ios"
    ? [(require("@expo/ui/swift-ui/modifiers") as typeof import("@expo/ui/swift-ui/modifiers"))
        .listSectionMargins({ length: 10, edges: "horizontal" })]
    : [];
```

### It boots, and it draws

With those four fixes the page renders with **zero console errors**, seven live
Skia canvases, the aurora preset drawn by the real shader, the black band under
the top, the family dots, the corner buttons and the slider. In headless
Chromium, software WebGL, first try.

What is visibly wrong is the geometry, and it is the interesting part: a browser
has no safe area insets, so `inferCutout` reads an `insetTop` of 0, concludes
there is no cutout, and the layout has nothing to hang on. On the web the
geometry has to be **chosen rather than measured**, defaulting to the 6.9 inch
iPhone.

> Written when the app carried a table of device presets and a way to name one
> from the URL. Both are gone: the capture pipeline gets a real cutout from the
> machine it runs on (an AOSP overlay on the emulator, an iPhone simulator on
> iOS), and the app measures, never chooses. A web build would have to bring its
> own table back, for itself, which is a page's concern rather than the app's.

The rest is layout: the slider is clipped at the right edge and the page does
not fill the viewport, both because a phone window is something the web does not
set up for you. Call it half a day.

None of this was committed. The four fixes and the two extra dependencies
(`react-dom`, `react-native-web`) are a decision, not a study, and they are
written out above in full so that landing them is a copy.

### What a web build costs, and what it is worth

The payload: 2.6 MB of JavaScript plus **8 MB of `canvaskit.wasm`** (about 3 MB
over the wire with Brotli, and it caches). That is a lot for a landing page and
nothing for a page whose entire purpose is to run an app.

What will never work in a browser, and should degrade rather than pretend:

| | On the web |
| - | ---------- |
| Save to Photos | a file download, which is what `export.web.ts` does |
| Liquid glass | absent, `Glass.tsx` already falls back to a blur |
| Haptics | no-op |
| Shake | needs `DeviceMotion` permission on iOS Safari, and means nothing on a desktop |
| Photo import | works, the picker is a file input |
| The rendering | **identical**, same shader, same `#000000` |

That last line is the reason to do it at all. The claim this project makes, one
drawing path for the preview and the export, verified out of the app against
CanvasKit, becomes something a visitor can *use* rather than read: the same
`drawRecipe` runs on the phone, in CI, and in their browser.

For a portfolio the strongest form is not a separate playground page but **the
real app, in the CSS 3D phone frame `tools/marketing/compose.cjs` already
draws**, running live and autoplaying the demo script until the visitor touches
it. The frame exists, the script exists, and the app is four one line fixes from
booting.

## 4. What I would do, in order

1. `src/demo/script.ts` plus demo mode. Unblocks the video, the screenshots and
   the web hero at once, and needs no Mac.
2. Metadata as files and the upload lanes, so the listing stops being manual.
3. One macOS session: play the script, capture the beats, record the video.
   Compose, conform, upload, iPhone and iPad.
4. Then, and only if the portfolio wants it, the web build. It is a day, it is
   not on the critical path of shipping, and it is the best single artefact this
   project could produce for a showcase.

The first run demo is a decision to take on a device once step 1 exists, not
now.
