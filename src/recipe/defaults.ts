import { maskFloor, type Geometry } from "../geometry/devices";
import { fadeSolidEnd } from "../render/draw";
import { presetSource } from "../render/palettes";
import type { Mask, MaskFamily, Recipe } from "./types";

/**
 * Defaults depend on the device, and that is the one real trap in family 01: on
 * a notch a bar flush with the cutout is enough, but on a Dynamic Island
 * stopping at the bottom of the island leaves an 11 pt strip of photo stranded
 * above the status bar. So every family starts at the safe area, which is where
 * `maskFloor` puts the line for all of them now.
 */
export function defaultMask(family: MaskFamily, g: Geometry): Mask {
  const floor = maskFloor(g);

  switch (family) {
    case "bar":
      return {
        type: "bar",
        height: floor,
        // A little more than the cutout's own radius: enough to read as a
        // deliberate join, not so much that it announces itself.
        corner: 0.35,
      };

    case "stripes":
      return { type: "stripes", density: 0.45 };

    case "fade":
      // The S curve: it leaves the black flat under the cutout and meets the
      // wallpaper without a corner, so it is the one that never shows a seam.
      // 88 and not the 130 it was. The solid black ends where the bar's does,
      // but a 130 point ramp puts the half way point 36 points below the bar's
      // edge, and what an eye calls "where the black stops" is that half way
      // point rather than where the ramp starts. Shorter, and the three
      // families read as beginning together, which they always did.
      return { type: "fade", fadeEnd: fadeSolidEnd(g) + 88, curve: 2 };
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
