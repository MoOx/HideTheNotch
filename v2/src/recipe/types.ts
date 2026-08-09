/**
 * Socle B — la recette.
 *
 * Un fond d'écran est décrit par cet objet, et rien d'autre. Le même objet est
 * rendu à l'écran et hors écran en pixels natifs : c'est ce qui garantit que ce
 * qu'on voit est ce qu'on enregistre. Il est sérialisable, donc partageable et
 * régénérable plus tard, pour un autre appareil, à n'importe quelle résolution.
 */

export type GradientPresetId = "aurore" | "brume" | "encre" | "braise" | "mousse";

export type Source =
  | { type: "gradient"; preset: GradientPresetId; seed: number }
  | {
      type: "photo";
      uri: string;
      /** Décalage du cadrage, en points. */
      dx: number;
      dy: number;
      /** Facteur de zoom, 1 = l'image couvre l'écran au plus juste. */
      zoom: number;
    };

export type MaskFamily = "bar" | "stripes" | "fade";

/** 01 · Bandeau plein. */
export type BarMask = {
  type: "bar";
  /** Hauteur du bandeau, en points, mesurée depuis le bord haut. */
  height: number;
  /** Rayon des coins bas, en points. */
  radius: number;
};

/** 11 · Trame dégressive. */
export type StripesMask = {
  type: "stripes";
  variant: "lines" | "grid" | "dots";
  /** Hauteur de la première bande après le bandeau de tête, en points. */
  period: number;
  /** Vitesse de décroissance : 0 = bandes constantes, 1 = disparition rapide. */
  decay: number;
};

/** 03 · Fondu dithéré. */
export type FadeMask = {
  type: "fade";
  /** Fin du noir absolu, en points. Ne peut pas remonter au-dessus de la découpe. */
  solidEnd: number;
  /** Fin du fondu, en points. */
  fadeEnd: number;
  /** 0 linéaire · 1 adouci · 2 en S. */
  curve: 0 | 1 | 2;
};

export type Mask = BarMask | StripesMask | FadeMask;

export type Recipe = {
  source: Source;
  mask: Mask;
};

export const FAMILY_ORDER: MaskFamily[] = ["bar", "stripes", "fade"];

export const FAMILY_LABEL: Record<MaskFamily, string> = {
  bar: "Bandeau",
  stripes: "Trame",
  fade: "Fondu",
};
