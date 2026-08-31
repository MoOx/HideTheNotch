import type { Geometry } from "../geometry/devices";

/**
 * A home screen, sketched, in the platform's own arrangement.
 *
 * **Preview only. This never reaches the export**: the exported wallpaper is
 * the recipe and nothing else.
 *
 * A wallpaper on its own does not tell you whether the mask works. The question
 * is always "does the black read as hardware once there are icons on top of
 * it", and that only has an answer with icons on top of it.
 *
 * The icons are deliberately blank, and the labels are bars rather than words.
 * Recognisable apps would pull the eye exactly where it should not go, and
 * invented app names would be six more strings to translate for something
 * nobody is meant to read.
 *
 * What is *not* arbitrary is the arrangement. A grid that does not match the
 * platform reads as wrong long before anyone can say why, so the two layouts
 * are the two real ones: four columns of squircles over a floating dock on
 * iOS, five columns of circles with a search pill on Android. Everything is
 * expressed as a fraction of the screen, so both hold at any size.
 *
 * This file is geometry and nothing else. It used to paint itself in Skia,
 * which was the only way while the store compositor had to draw the same grid
 * outside the app. Nothing does any more, so the tiles are laid out here and
 * `HomeGrid.tsx` puts the platform's own material in them.
 */
export type HomeStyle = "ios" | "android";

/** One rounded rectangle, in points. */
export type Tile = { x: number; y: number; w: number; h: number; r: number };

export type HomeLayout = {
  /** The blank app icons on the page. */
  icons: Tile[];
  /** The bars standing in for names, under the page's icons. */
  labels: Tile[];
  /** The icons in the dock, which have no names and arrive from elsewhere. */
  dock: Tile[];
  /** The dock's container on iOS, the search pill on Android. */
  plates: Tile[];
};

type Metrics = {
  cols: number;
  rows: number;
  /** Icon side, as a fraction of the screen width. */
  icon: number;
  /** Side margin, as a fraction of the screen width. */
  margin: number;
  /** Vertical pitch between rows, as a multiple of the icon side. */
  pitch: number;
  /** Corner radius, as a fraction of the icon side. 0.5 is a circle. */
  round: number;
  /** Where the first row starts, below the safe area, in icon sides. */
  top: number;
  /**
   * Which end the rows hang from.
   *
   * `top` fills downward from below the status bar, which is where an iPhone
   * puts its first row. `dock` stacks them upward from the dock instead, one
   * pitch apart like any other pair of rows, which is where a Pixel's look
   * once the page is not full.
   */
  from: "top" | "dock";
};

/**
 * iOS, measured off a real home screen rather than remembered.
 *
 * A 6.9 inch screenshot is 1320 x 2868, so 440 pt at three times. Its label
 * rows sit at 170, 278.7, 387.3 and 495.7 pt, and the four columns are centred
 * at 67.7, 168.3, 268.7 and 369.7. That gives a 108.6 pt row pitch and a
 * 100.7 pt column pitch, and with the label at `top + size * 1.14` it puts the
 * icon at 65.9 pt and the margin at 34.7.
 *
 * The size and the start were already right to within two points. The row pitch
 * was not: 1.47 icon sides against a real 1.65, which is why two rows of this
 * sketch sat visibly closer together than two rows of the phone it is drawn on.
 *
 * The squircle is not a rounded rectangle, but at this size the difference is a
 * rounding error.
 *
 * Android, a Pixel: five columns of round icons, smaller, tighter, with the
 * search pill above the dock rather than a container behind it.
 */
const METRICS: Record<HomeStyle, Metrics> = {
  ios: {
    cols: 4,
    rows: 2,
    icon: 0.1497,
    margin: 0.079,
    pitch: 1.648,
    round: 0.2237,
    top: 0.5,
    from: "top",
  },
  android: {
    cols: 5,
    rows: 2,
    icon: 0.132,
    margin: 0.06,
    pitch: 1.62,
    round: 0.5,
    top: 1.05,
    from: "dock",
  },
};

export function homeLayout(g: Geometry, style: HomeStyle): HomeLayout {
  const m = METRICS[style];
  const size = g.width * m.icon;
  const margin = g.width * m.margin;
  const gap = (g.width - margin * 2 - size * m.cols) / (m.cols - 1);
  const radius = size * m.round;
  const pitch = size * m.pitch;

  // The first row clears the status bar the way the system lays it out. Icons
  // never sit under the cutout, so the mask is judged against the row below it,
  // and a bar tall enough to swallow that row says so plainly.
  const top = Math.max(g.insetTop, 24) + size * m.top;

  const icons: Tile[] = [];
  const labels: Tile[] = [];
  const dock: Tile[] = [];
  const plates: Tile[] = [];

  /** One icon, and the bar that stands in for its name. */
  const tile = (x: number, y: number, named = true) => {
    (named ? icons : dock).push({ x, y, w: size, h: size, r: radius });
    if (!named) {
      return;
    }
    // A label is a word nobody reads at this size: a bar of about the right
    // length says "there is a name here" without inventing one.
    const w = size * 0.62;
    const h = Math.max(2, size * 0.075);
    labels.push({ x: x + (size - w) / 2, y: y + size + size * 0.14, w, h, r: h / 2 });
  };

  // The dock is laid out first, because on Android it is what the rows hang
  // from. A grid that stops two rows in has to stop somewhere on purpose: two
  // rows adrift in the middle of the screen is a page nobody has.
  //
  // The dock does not respect the bottom safe area, and neither does the real
  // one: on iOS the container's lower edge sits about 26 pt from the physical
  // edge, which is *past* the safe area line, with the home indicator drawn on
  // top of it rather than below it. Insetting it by the safe area, which is
  // what this did, pushed it a good 20 pt too high and made the screen look
  // like a screenshot of a smaller phone.
  const bottom = g.height - g.height * 0.028;
  /** The top of the dock row, which the grid measures itself against. */
  let dockTop = bottom;

  if (style === "ios") {
    // The dock is the one part of an iOS home screen that is a single shape.
    const pad = size * 0.22;
    const dockH = size + pad * 2;
    const dockY = bottom - dockH;
    dockTop = dockY + pad;
    plates.push({
      x: margin * 0.6,
      y: dockY,
      w: g.width - margin * 1.2,
      h: dockH,
      r: dockH * 0.32,
    });
    for (let c = 0; c < m.cols; c += 1) {
      tile(margin + c * (size + gap), dockY + pad, false);
    }
  } else {
    // Android puts nothing behind its dock, and a search pill under it.
    const pill = size * 0.62;
    const pillY = bottom - pill;
    plates.push({ x: margin, y: pillY, w: g.width - margin * 2, h: pill, r: pill / 2 });
    const dockY = pillY - size - g.height * 0.022;
    dockTop = dockY;
    for (let c = 0; c < m.cols; c += 1) {
      tile(margin + c * (size + gap), dockY, false);
    }
  }

  // One pitch between every pair of rows, the dock included: the space above
  // the dock is the space between two rows and not a second, invented number.
  const first = m.from === "dock" ? dockTop - m.rows * pitch : top;
  for (let r = 0; r < m.rows; r += 1) {
    for (let c = 0; c < m.cols; c += 1) {
      tile(margin + c * (size + gap), first + r * pitch);
    }
  }

  return { icons, labels, dock, plates };
}
