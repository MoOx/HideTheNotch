import type { GradientPresetId, MaskFamily } from "../recipe/types";

import type { DemoSheet } from "./script";

/**
 * The states the store deck is photographed in, as data.
 *
 * Same idea as the demo script and for the same reason: the app is a function
 * of a recipe, so a screenshot is a recipe plus which sheet is up, and a deck
 * is a list of those. What this buys is that the capture script has nothing to
 * drive. It opens a URL, the app arrives at the state, `simctl` photographs it.
 * No UI automation, no accessibility identifiers, no test target to keep alive
 * through `expo prebuild --clean`, and the build being photographed is the
 * build that ships.
 *
 *   xcrun simctl openurl booted hidethenotch://shot/02-import
 *
 * The ids are the file names, so the order in the deck is the order here.
 */
export type Shot = {
  id: string;
  family: MaskFamily;
  palette: GradientPresetId;
  /** The one setting of that family, 0 to 1, as the slider drives it. */
  param?: number;
  /** Only meaningful for the band. */
  corner?: number;
  sheet?: DemoSheet;
  /** The sketched home screen, which is where the cutout stops existing. */
  peek?: boolean;
  /**
   * Use the photo the capture script left in the app's own storage, rather
   * than a preset.
   *
   * A store deck that only ever shows gradients answers "does it work with my
   * pictures?" with silence, and that is the question a wallpaper app is
   * actually asked. The capture scripts put a JPEG where the app can read it
   * without a picker and without a permission prompt; nothing else in the app
   * looks at it.
   */
  photo?: boolean;
  /**
   * Split the screen: the wallpaper as it was on one side, the effect on the
   * other. The app draws it, so the shot is a screenshot of the app doing it
   * rather than two renders pasted together afterwards.
   */
  compare?: boolean;
};

/**
 * How the deck's photo is framed, in points.
 *
 * Cover framing centres the crop, and centred on this photo is the one column
 * of it that is nearly black: a chair leg behind the cat. The mask would then
 * paint black over black and the before and after halves of the split would be
 * identical, which is the opposite of a demonstration. Ninety six points to the
 * side puts the bright wall under the cutout instead.
 *
 * Read by the app when a shot asks for the photo, and by `screens.cjs` when it
 * renders the two halves of the split, so the deck frames it once.
 */
/**
 * How long a sheet takes to finish coming up, plus a little.
 *
 * Neither platform's sheet says when it has landed, and photographing one
 * halfway up is how a slot ends up showing a rectangle sliding. Half a second
 * covers SwiftUI's presentation and Material's, and it is only ever paid on the
 * shots that open one.
 */
export const SHEET_SETTLE = 500;

export const PHOTO_FRAMING = { dx: 0, dy: 0, zoom: 1 };

export const SHOTS: Shot[] = [
  // The app at rest, on a gradient, with the controls in view: the slot that
  // has to answer "is this a tool or a wallpaper pack".
  { id: "01-editor", family: "fade", palette: "aurora", param: 0.2 },
  // The import sheet, over a photo, which is the answer to "can I use my own
  // pictures" said rather than claimed.
  { id: "02-import", family: "fade", palette: "aurora", param: 0.25, sheet: "source", photo: true },
  // The band, rounded as far as it goes, under icons. The shape is the subject
  // here, so the chrome is out of the way and the home screen is in.
  //
  // Three quarters of the height rather than all of it: at the maximum the band
  // reaches the first row of icons and the two touch, which reads as a mistake
  // in a screenshot whose whole subject is a shape. The rounding stays at the
  // maximum, since that is what is being shown.
  { id: "03-home", family: "bar", palette: "haze", param: 0.5, corner: 1, peek: true },
  // Where it ends up: the export sheet, with the pixel count it will produce,
  // over the one preset that runs light at the bottom and its stripes. The
  // wallpaper has to be worth exporting for the slot to mean anything.
  { id: "04-export", family: "stripes", palette: "neon", param: 0.8, sheet: "export" },
  // The claim, made by the app rather than about it: one photo, the effect on
  // half of it. It is the deck's opening slot, and it is a screenshot like the
  // others now, so the glass, the status bar and the icons in it are the real
  // ones instead of a composite of two offscreen renders.
  {
    id: "05-compare",
    family: "fade",
    palette: "aurora",
    param: 0.25,
    photo: true,
    compare: true,
    peek: true,
  },
];
