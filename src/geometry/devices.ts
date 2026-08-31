/**
 * Foundation A, geometry.
 *
 * Everything measurable is measured (window size, density, safe areas), and
 * the cutout now comes from the system on both platforms: Android publishes
 * the rectangle through `DisplayCutout` (`modules/htn-cutout`), iOS publishes
 * nothing at all, so there it is the hardware identifier against a table of
 * iPhones (`models.ts`).
 *
 * Below both of those sits the safe area, which is what `inferCutout` reads,
 * and which is enough on its own to keep a mask safe. See `maskFloor`.
 */

export type CutoutKind = "island" | "notch" | "punch" | "none";

/**
 * Who answered "where is the hole", which decides how far the answer is
 * trusted.
 *
 * `system` is the device itself, through `DisplayCutout`. It is the only one
 * that is a measurement, and the only one the black is allowed to stop at.
 * `models` is the table of iPhones, exact in principle and contradicted in
 * practice: a Dynamic Island whose box says it ends at 48.3 pt still showed a
 * pixel or two under a bar of exactly that height. `safeArea` is no answer at
 * all, and it is what a phone this app has never heard of gets.
 */
export type CutoutSource = "system" | "models" | "safeArea";

/** Cutout box, in points, origin at the top left of the screen. */
export type Cutout = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Corner radius, in points. */
  r: number;
};

export type Geometry = {
  label: string;
  kind: CutoutKind;
  /** Logical screen size, in points. */
  width: number;
  height: number;
  /** Physical pixels per point. */
  scale: number;
  insetTop: number;
  insetBottom: number;
  cutout: Cutout;
  cutoutFrom: CutoutSource;
};

/**
 * The Dynamic Island is the same physical size on every iPhone that has one,
 * from the 14 Pro to the 17 Pro Max. That is what makes detection reliable: as
 * soon as the top inset is 59 pt, these values apply as they are.
 */
export const ISLAND = { w: 125, h: 37.33, y: 11, r: 18.67 } as const;

/** iPhone X through 12 Pro Max. */
export const NOTCH_WIDE = { w: 209, h: 30, y: 0, r: 20 } as const;

/** iPhone 13 through 14 Plus: notch narrowed by about 20 percent. */
export const NOTCH_NARROW = { w: 161, h: 32, y: 0, r: 20 } as const;

function centered(width: number, c: { w: number; h: number; y: number; r: number }): Cutout {
  return { x: (width - c.w) / 2, y: c.y, w: c.w, h: c.h, r: c.r };
}

/**
 * Infers the cutout from what the system is willing to say.
 *
 * This is the fallback under both of the exact answers: an iPhone missing from
 * the model table (a phone newer than that table), and an Android device whose
 * native module said nothing (Expo Go, or Android 8 and older).
 *
 * On iOS the top inset is a good signal: 59 pt means Dynamic Island, 44 to
 * 48 pt means a notch, less means nothing. On Android it is the larger of the
 * status bar and the hole with no way to tell which, so there is nothing to
 * infer and it says so. Either way the mask stays safe, because the mask is
 * measured from the safe area rather than from this.
 */
export function inferCutout(
  os: string,
  width: number,
  insetTop: number,
): { kind: CutoutKind; cutout: Cutout } {
  if (os === "ios") {
    if (insetTop >= 55) {
      return { kind: "island", cutout: centered(width, ISLAND) };
    }
    if (insetTop >= 40) {
      // Assume the wide notch: on full width masks only the height matters,
      // and too wide beats too short.
      return { kind: "notch", cutout: centered(width, NOTCH_WIDE) };
    }
    return { kind: "none", cutout: { x: width / 2, y: 0, w: 0, h: 0, r: 0 } };
  }

  return { kind: "none", cutout: { x: width / 2, y: 0, w: 0, h: 0, r: 0 } };
}

/**
 * Android's own answer, turned into a cutout.
 *
 * `DisplayCutout.getBoundingRectTop()` hands back the real rectangle in display
 * pixels, which is the one thing no inset can say: where across the width the
 * hole sits. A punch hole two thirds of the way to the left and a centred one
 * have the same top inset and are different pictures.
 *
 * What Android does not hand back is the corner radius or the *name* of the
 * shape, so both are read off the box. A hole about as tall as it is wide is a
 * punch hole and its radius is half its height; anything much wider than it is
 * tall is a notch, and rounding it by its height is what a notch looks like at
 * the bottom. Getting the name wrong costs a slightly different drawing, never
 * a mask that misses: the mask only uses the bottom edge.
 */
export function cutoutFromRect(
  rect: { x: number; y: number; w: number; h: number },
  density: number,
): { kind: CutoutKind; cutout: Cutout } {
  const x = rect.x / density;
  const y = rect.y / density;
  const w = rect.w / density;
  const h = rect.h / density;
  return {
    kind: w >= h * 2.2 ? "notch" : "punch",
    cutout: { x, y, w, h, r: Math.min(w, h) / 2 },
  };
}

/**
 * Radius of the display's own bottom corners, in points.
 *
 * Apple does not publish it and it is not a fixed fraction of the width: the
 * notch era phones are noticeably squarer than the current ones. These are the
 * measured values, and they matter because a black shape that meets the screen
 * edge is read against them.
 */
export function screenCorner(g: Geometry): number {
  switch (g.kind) {
    case "island":
      return 55;
    case "notch":
      return 47.33;
    default:
      return g.width * 0.12;
  }
}

/** Bottom of the cutout: nothing above this line can be masked. */
export function cutoutBottom(g: Geometry): number {
  return g.kind === "none" ? 0 : g.cutout.y + g.cutout.h;
}

/**
 * How much a number that was read rather than measured is worth, in points.
 *
 * A table entry is exact in principle and was half a point short the one time
 * it met a real phone: a Dynamic Island whose box ends at 48.3 pt still showed
 * a pixel or two under a bar of exactly that height. So the entry sits in the
 * middle of a band this wide. The default keeps clear of it by that much, and
 * the user is allowed the same distance under it, which is the room it takes to
 * watch the edge appear and find out what the number should have been.
 *
 * It applies to a table and to nothing else. A hole the device measured is not
 * in doubt.
 */
const DOUBT = 2;

/**
 * The line the black starts from.
 *
 * The bottom of the hole, since every mask here is a full width band and where
 * the hole sits across the width has never changed a single pixel of one. Where
 * that bottom comes from is the whole question, and `cutoutFrom` answers it:
 *
 * - `system`, the device measured its own hole. Taken exactly.
 * - `models`, a table of iPhones said so. Taken with `DOUBT` points of clearance.
 * - `safeArea`, nobody knows. The safe area is the fallback, and it is the only
 *   line that cannot be wrong: a cutout is inside it by construction. Apple
 *   defines it to clear the sensor housing, which is why an island ends 10.7 pt
 *   above it and a notch 14 to 17, and Android's top inset is asked for as
 *   `statusBars | displayCutout | navigationBars`, so it is the larger of the
 *   status bar and the hole, never the smaller.
 *
 * It is a fallback and not the rule, which it briefly was. Being generous by
 * 10.7 pt on every island iPhone, and by the whole height of a status bar on
 * Android, is a band nobody asked for on the two platforms that can say better.
 */
export function maskFloor(g: Geometry): number {
  if (g.kind === "none" || g.cutoutFrom === "safeArea") {
    return Math.max(g.insetTop, 1);
  }
  return Math.max(cutoutBottom(g) + (g.cutoutFrom === "models" ? DOUBT : 0), 1);
}

/**
 * The lowest the user may take a mask, which is not always the floor.
 *
 * Nothing here is a dare. It is the only way to find out where a hole really
 * ends, since no screenshot will ever contain one: you lower the black until
 * the edge appears, and the height at which it appears is the answer. On a
 * phone this app has never heard of it is also the only way to get a mask that
 * is not needlessly tall, hence the user's own rule of thumb, four fifths of
 * the safe area.
 *
 * A device that measured its own hole gets none of this. There is nothing to
 * second guess and no reason to offer a setting whose only effect would be to
 * uncover the camera.
 */
export function maskLimit(g: Geometry): number {
  switch (g.cutoutFrom) {
    case "system":
      return maskFloor(g);
    case "models":
      return Math.max(cutoutBottom(g) - DOUBT, 1);
    case "safeArea":
      return Math.max(g.insetTop * 0.8, 1);
  }
}
