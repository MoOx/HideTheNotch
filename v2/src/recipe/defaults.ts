import { cutoutBottom, type Geometry } from "../geometry/devices";
import { ISLAND } from "../geometry/devices";
import type { Mask, MaskFamily, Recipe } from "./types";

/**
 * Les valeurs par défaut dépendent de l'appareil, et c'est le seul vrai piège de
 * la famille 01 : sur une encoche, un bandeau à ras de la découpe suffit ; sur
 * une Dynamic Island, s'arrêter au bas de l'île laisse une bande de photo de
 * 11 pt coincée au-dessus de la barre d'état. On descend donc à la safe area.
 */
export function defaultMask(family: MaskFamily, g: Geometry): Mask {
  const floor = cutoutBottom(g);

  switch (family) {
    case "bar":
      return {
        type: "bar",
        height: g.kind === "island" ? Math.max(floor, g.insetTop) : Math.max(floor, 1),
        // Aligné sur le rayon de l'île : le bandeau se lit alors comme une
        // extension du matériel plutôt que comme un ajout.
        radius: g.kind === "none" ? 0 : ISLAND.r,
      };

    case "stripes":
      return { type: "stripes", variant: "lines", period: 26, decay: 0.45 };

    case "fade":
      return {
        type: "fade",
        solidEnd: Math.max(floor + 4, g.insetTop * 0.6),
        fadeEnd: Math.max(floor + 4, g.insetTop * 0.6) + 130,
        curve: 1,
      };
  }
}

export function defaultRecipe(g: Geometry): Recipe {
  return {
    source: { type: "gradient", preset: "aurore", seed: 1 },
    mask: defaultMask("bar", g),
  };
}

export function familyOf(mask: Mask): MaskFamily {
  return mask.type;
}
