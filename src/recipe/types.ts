/**
 * Foundation B, the recipe.
 *
 * A wallpaper is described by this object and nothing else. The same object is
 * rendered on screen and offscreen at native pixel resolution, which is what
 * guarantees that what you see is what you save. It is serialisable, so it can
 * be shared and regenerated later, for another device, at any resolution.
 */

export type GradientPresetId = "aurora" | "haze" | "ink" | "ember" | "moss";

export type Source =
  | { type: "gradient"; preset: GradientPresetId; seed: number }
  | {
      type: "photo";
      uri: string;
      /** Framing offset, in points. */
      dx: number;
      dy: number;
      /** Zoom factor, 1 means the image just covers the screen. */
      zoom: number;
    };

export type MaskFamily = "bar" | "stripes" | "fade";

/**
 * 01, solid bar. Height is the only setting: the corner radius is derived from
 * it, see `barRadius` in `../render/draw`.
 */
export type BarMask = {
  type: "bar";
  /** Bar height, in points, measured from the top edge. */
  height: number;
};

/**
 * 11, decaying stripes.
 *
 * Band height and decay rate are not two settings. Left free they produce
 * results that are simply bad: a second band too thin to read, or bands so
 * regular that the top half of the screen becomes solid black for no reason.
 * One value drives both, along a line where every position works. See
 * `stripeGeometry` in `../render/draw`.
 */
export type StripesMask = {
  type: "stripes";
  /** 0 fine and quickly gone, 1 bolder and reaching further down. */
  density: number;
};

/**
 * 03, dithered fade.
 *
 * The end of absolute black is not a setting either: it has to sit just under
 * the cutout, which is where the geometry already puts it. See `fadeSolidEnd`
 * in `../render/draw`.
 */
export type FadeMask = {
  type: "fade";
  /** End of the fade, in points. */
  fadeEnd: number;
  /** 0 linear, 1 eased, 2 S curve. */
  curve: 0 | 1 | 2;
};

export type Mask = BarMask | StripesMask | FadeMask;

export type Recipe = {
  source: Source;
  mask: Mask;
};

/**
 * The fade comes first: it is the one that reads as intentional on any
 * wallpaper, so it is what the app should open on.
 */
export const FAMILY_ORDER: MaskFamily[] = ["fade", "bar", "stripes"];

/**
 * What each family is called on screen.
 *
 * "Blinds" rather than "stripes" or "dashes": the pattern is horizontal slats
 * thinning as they go down, and a venetian blind is the everyday object that
 * looks exactly like it. Naming it after a thing people own beats naming it
 * after the drawing primitive.
 */
export const FAMILY_LABEL: Record<MaskFamily, string> = {
  fade: "Fade",
  bar: "Band",
  stripes: "Blinds",
};
