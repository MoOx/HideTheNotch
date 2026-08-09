/**
 * Foundation A, geometry.
 *
 * Everything measurable is measured (window size, density, safe areas). The
 * table below only covers what iOS does not publish: the exact box of the
 * cutout. On Android `DisplayCutout.getBoundingRects()` gives the real
 * rectangles, but reading it needs a native module.
 */

export type CutoutKind = "island" | "notch" | "punch" | "none";

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
  /** True when the box is inferred from safe areas rather than known. */
  estimated: boolean;
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
 * On iOS the top inset is a reliable signal: 59 pt means Dynamic Island,
 * 44 to 48 pt means a notch, less means nothing. On Android it is the status
 * bar height, which has nothing to do with the cutout, so we do not guess and
 * hand control back to the user through the device picker.
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
      // Assume the wide notch: on full width masks only the height matters,
      // and too wide beats too short.
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

/** Bottom of the cutout: nothing above this line can be masked. */
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
 * Export targets. Two uses: forcing a render when detection is unreliable
 * (Android), and making a wallpaper for someone else's phone.
 */
export const DEVICE_PRESETS: DevicePreset[] = [
  preset("island-393", "Dynamic Island", "393 x 852, 14 Pro, 15, 16", 393, 852, 3, 59, "island", ISLAND),
  preset("island-402", "Dynamic Island", "402 x 874, 16 Pro, 17", 402, 874, 3, 59, "island", ISLAND),
  preset("island-430", "Dynamic Island", "430 x 932, 14/15 Pro Max", 430, 932, 3, 59, "island", ISLAND),
  preset("island-440", "Dynamic Island", "440 x 956, 16/17 Pro Max", 440, 956, 3, 59, "island", ISLAND),
  preset("notch-390", "Notch", "390 x 844, 12, 13, 14", 390, 844, 3, 47, "notch", NOTCH_WIDE),
  preset("notch-375", "Notch", "375 x 812, X, XS, 13 mini", 375, 812, 3, 44, "notch", NOTCH_WIDE),
  preset("notch-428", "Notch", "428 x 926, 12/13 Pro Max", 428, 926, 3, 47, "notch", NOTCH_WIDE),
  preset("punch-c", "Centred punch hole", "412 x 915, Android", 412, 915, 2.625, 32, "punch",
    { w: 26, h: 26, y: 14, r: 13 }),
  preset("punch-l", "Left punch hole", "412 x 915, Android", 412, 915, 2.625, 32, "punch",
    { w: 26, h: 26, y: 14, r: 13 }, 412 * 0.28),
];

export function geometryFromPreset(p: DevicePreset): Geometry {
  return {
    label: `${p.label}, ${p.sub}`,
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
