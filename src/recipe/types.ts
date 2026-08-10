/**
 * Foundation B, the recipe.
 *
 * A wallpaper is described by this object and nothing else. The same object is
 * rendered on screen and offscreen at native pixel resolution, which is what
 * guarantees that what you see is what you save. It is serialisable, so it can
 * be shared and regenerated later, for another device, at any resolution.
 */

export type GradientPresetId = "aurora" | "haze" | "ink" | "ember" | "moss";

/**
 * One coloured point of the gradient.
 *
 * Position is a fraction of the screen, not points, so a recipe made on one
 * phone renders the same composition on another. Both may sit a little outside
 * 0 to 1: a point just off the edge pulls its colour in from beyond the frame,
 * which is the difference between a corner that is coloured and a corner that
 * is the end of something.
 */
export type MeshPoint = {
  x: number;
  y: number;
  /** `#RRGGBB`. */
  color: string;
};

/** How many the shader carries. Nine is a 3 by 3, which is already a lot. */
export const MESH_MAX = 8;

export type Source =
  | {
      type: "gradient";
      /** Which preset it came from, or null once a point has been touched. */
      preset: GradientPresetId | null;
      points: MeshPoint[];
    }
  | {
      type: "photo";
      uri: string;
      /** Framing offset, in points. */
      dx: number;
      dy: number;
      /** Zoom factor, 1 means the image just covers the screen. */
      zoom: number;
    };

export type MaskFamily = "bar" | "stripes" | "fade" | "decor";

/** 01, solid bar. */
export type BarMask = {
  type: "bar";
  /** Bar height, in points, measured from the top edge. */
  height: number;
  /**
   * How round the join with the screen edge is, from 0 to 1.
   *
   * It was derived from the height, which was tidy and wrong: the two are
   * independent judgements. At 1 it is exactly the display's own corner radius,
   * so the band can be made to continue the panel rather than approximate it.
   */
  corner: number;
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

/** 08, decor. */
export type DecorPattern = "rig" | "vine" | "garland";

export type DecorMask = {
  type: "decor";
  pattern: DecorPattern;
  /** How much of it there is: 0 one object, 1 a scene. */
  density: number;
  /** Same seed, same drawing, so a result can be got back. */
  seed: number;
};

export type Mask = BarMask | StripesMask | FadeMask | DecorMask;

export type Recipe = {
  source: Source;
  mask: Mask;
};

/**
 * The fade comes first: it is the one that reads as intentional on any
 * wallpaper, so it is what the app should open on.
 */
export const FAMILY_ORDER: MaskFamily[] = ["fade", "bar", "stripes", "decor"];

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
  decor: "Decor",
};
