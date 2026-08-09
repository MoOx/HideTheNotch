/**
 * Socle A — géométrie.
 *
 * Tout ce qui est mesurable est mesuré (taille de fenêtre, densité, safe area).
 * La table ci-dessous ne sert qu'à ce qu'iOS ne dit pas : la boîte exacte de la
 * découpe. Sur Android, `DisplayCutout.getBoundingRects()` la donne vraiment —
 * cf. `docs/geometry.md` — mais il faut un module natif pour la lire.
 */

export type CutoutKind = "island" | "notch" | "punch" | "none";

/** Boîte de la découpe, en points, origine en haut à gauche de l'écran. */
export type Cutout = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rayon des coins, en points. */
  r: number;
};

export type Geometry = {
  label: string;
  kind: CutoutKind;
  /** Taille logique de l'écran, en points. */
  width: number;
  height: number;
  /** Pixels physiques par point. */
  scale: number;
  insetTop: number;
  insetBottom: number;
  cutout: Cutout;
  /** Vrai quand la boîte est déduite des safe areas au lieu d'être connue. */
  estimated: boolean;
};

/**
 * La Dynamic Island a la même taille physique sur tous les iPhone qui en ont
 * une, du 14 Pro au 17 Pro Max. C'est ce qui rend la détection fiable : dès que
 * l'inset haut vaut 59 pt, ces valeurs s'appliquent telles quelles.
 */
export const ISLAND = { w: 125, h: 37.33, y: 11, r: 18.67 } as const;

/** iPhone X → 12 Pro Max. */
export const NOTCH_WIDE = { w: 209, h: 30, y: 0, r: 20 } as const;

/** iPhone 13 → 14 Plus : encoche réduite d'environ 20 %. */
export const NOTCH_NARROW = { w: 161, h: 32, y: 0, r: 20 } as const;

function centered(width: number, c: { w: number; h: number; y: number; r: number }): Cutout {
  return { x: (width - c.w) / 2, y: c.y, w: c.w, h: c.h, r: c.r };
}

/**
 * Déduit la découpe de ce que le système accepte de dire.
 *
 * Sur iOS l'inset haut est un indicateur fiable : 59 pt ⇒ Dynamic Island,
 * 44-48 pt ⇒ encoche, moins ⇒ rien. Sur Android il vaut la hauteur de la barre
 * d'état, qui n'a rien à voir avec la découpe : on ne devine pas, on rend la
 * main à l'utilisateur via le sélecteur d'appareil.
 */
export function inferCutout(
  os: string,
  width: number,
  insetTop: number
): { kind: CutoutKind; cutout: Cutout; estimated: boolean } {
  if (os === "ios") {
    if (insetTop >= 55) {
      return { kind: "island", cutout: centered(width, ISLAND), estimated: false };
    }
    if (insetTop >= 40) {
      // On prend l'encoche large : sur les familles pleine largeur seule la
      // hauteur compte, et trop large vaut mieux que trop court.
      return { kind: "notch", cutout: centered(width, NOTCH_WIDE), estimated: true };
    }
    return { kind: "none", cutout: { x: width / 2, y: 0, w: 0, h: 0, r: 0 }, estimated: false };
  }

  return {
    kind: "none",
    cutout: { x: width / 2, y: 0, w: 0, h: 0, r: 0 },
    estimated: true,
  };
}

/** Le bas de la découpe : rien ne peut être masqué au-dessus de cette ligne. */
export function cutoutBottom(g: Geometry): number {
  return g.kind === "none" ? 0 : g.cutout.y + g.cutout.h;
}

export type DevicePreset = {
  id: string;
  label: string;
  sub: string;
  width: number;
  height: number;
  scale: number;
  insetTop: number;
  insetBottom: number;
  kind: CutoutKind;
  cutout: Cutout;
};

function preset(
  id: string,
  label: string,
  sub: string,
  width: number,
  height: number,
  scale: number,
  insetTop: number,
  kind: CutoutKind,
  c: { w: number; h: number; y: number; r: number },
  cx?: number
): DevicePreset {
  const cutout =
    cx === undefined
      ? centered(width, c)
      : { x: cx - c.w / 2, y: c.y, w: c.w, h: c.h, r: c.r };
  return {
    id,
    label,
    sub,
    width,
    height,
    scale,
    insetTop,
    insetBottom: kind === "none" ? 24 : 34,
    kind,
    cutout,
  };
}

/**
 * Cibles d'export. Sert à deux choses : forcer un rendu quand la détection est
 * incertaine (Android), et générer un fond pour le téléphone de quelqu'un
 * d'autre.
 */
export const DEVICE_PRESETS: DevicePreset[] = [
  preset("island-393", "Dynamic Island", "393 × 852 · 14 Pro, 15, 16", 393, 852, 3, 59, "island", ISLAND),
  preset("island-402", "Dynamic Island", "402 × 874 · 16 Pro, 17", 402, 874, 3, 59, "island", ISLAND),
  preset("island-430", "Dynamic Island", "430 × 932 · 14/15 Pro Max", 430, 932, 3, 59, "island", ISLAND),
  preset("island-440", "Dynamic Island", "440 × 956 · 16/17 Pro Max", 440, 956, 3, 59, "island", ISLAND),
  preset("notch-390", "Encoche", "390 × 844 · 12, 13, 14", 390, 844, 3, 47, "notch", NOTCH_WIDE),
  preset("notch-375", "Encoche", "375 × 812 · X, XS, 13 mini", 375, 812, 3, 44, "notch", NOTCH_WIDE),
  preset("notch-428", "Encoche", "428 × 926 · 12/13 Pro Max", 428, 926, 3, 47, "notch", NOTCH_WIDE),
  preset("punch-c", "Poinçon centré", "412 × 915 · Android", 412, 915, 2.625, 32, "punch",
    { w: 26, h: 26, y: 14, r: 13 }),
  preset("punch-l", "Poinçon à gauche", "412 × 915 · Android", 412, 915, 2.625, 32, "punch",
    { w: 26, h: 26, y: 14, r: 13 }, 412 * 0.28),
];

export function geometryFromPreset(p: DevicePreset): Geometry {
  return {
    label: `${p.label} · ${p.sub}`,
    kind: p.kind,
    width: p.width,
    height: p.height,
    scale: p.scale,
    insetTop: p.insetTop,
    insetBottom: p.insetBottom,
    cutout: p.cutout,
    estimated: false,
  };
}
