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

/** 01, solid bar. */
export type BarMask = {
  type: "bar";
  /** Bar height, in points, measured from the top edge. */
  height: number;
  /** Radius of the bottom corners, in points. */
  radius: number;
};

/** 11, decaying stripes. */
export type StripesMask = {
  type: "stripes";
  variant: "lines" | "grid" | "dots";
  /** Height of the first band after the head band, in points. */
  period: number;
  /** Decay rate: 0 keeps bands constant, 1 makes them vanish quickly. */
  decay: number;
};

/** 03, dithered fade. */
export type FadeMask = {
  type: "fade";
  /** End of absolute black, in points. Cannot rise above the cutout. */
  solidEnd: number;
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

export const FAMILY_ORDER: MaskFamily[] = ["bar", "stripes", "fade"];

export const FAMILY_LABEL: Record<MaskFamily, string> = {
  bar: "Bar",
  stripes: "Stripes",
  fade: "Fade",
};
