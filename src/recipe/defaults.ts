import { cutoutBottom, type Geometry } from "../geometry/devices";
import { fadeSolidEnd } from "../render/draw";
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
      };

    case "stripes":
      return { type: "stripes", density: 0.45 };

    case "fade":
      return { type: "fade", fadeEnd: fadeSolidEnd(g) + 130, curve: 1 };
  }
}

export function defaultRecipe(g: Geometry): Recipe {
  return {
    source: { type: "gradient", preset: "aurora", seed: 1 },
    mask: defaultMask("bar", g),
  };
}

export function familyOf(mask: Mask): MaskFamily {
  return mask.type;
}
