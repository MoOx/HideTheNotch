import { cutoutBottom, type Geometry } from "../geometry/devices";
import { fadeSolidEnd } from "../render/draw";
import { presetSource } from "../render/palettes";
import type { Mask, MaskFamily, Recipe } from "./types";

/**
 * Defaults depend on the device, and that is the one real trap in family 01: on
 * a notch a bar flush with the cutout is enough, but on a Dynamic Island
 * stopping at the bottom of the island leaves an 11 pt strip of photo stranded
 * above the status bar. So we go down to the safe area.
 */
export function defaultMask(family: MaskFamily, g: Geometry): Mask {
  const floor = cutoutBottom(g);

  switch (family) {
    case "bar":
      return {
        type: "bar",
        height: g.kind === "island" ? Math.max(floor, g.insetTop) : Math.max(floor, 1),
        // A little more than the cutout's own radius: enough to read as a
        // deliberate join, not so much that it announces itself.
        corner: 0.35,
      };

    case "stripes":
      return { type: "stripes", density: 0.45 };

    case "decor":
      return { type: "decor", pattern: "rig", density: 0.4, seed: 1 };

    case "fade":
      // The S curve: it leaves the black flat under the cutout and meets the
      // wallpaper without a corner, so it is the one that never shows a seam.
      return { type: "fade", fadeEnd: fadeSolidEnd(g) + 130, curve: 2 };
  }
}

export function defaultRecipe(g: Geometry): Recipe {
  return {
    source: presetSource("aurora"),
    mask: defaultMask("fade", g),
  };
}

export function familyOf(mask: Mask): MaskFamily {
  return mask.type;
}
