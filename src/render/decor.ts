import {
  PaintStyle,
  Skia,
  StrokeCap,
  type SkCanvas,
  type SkPaint,
} from "@shopify/react-native-skia";

import type { Geometry } from "../geometry/devices";
import type { DecorMask, DecorPattern } from "../recipe/types";

/**
 * 08, decor.
 *
 * A shape hanging from the top edge that happens to cover the cutout, rather
 * than a band that admits to covering it. The trick that removes all the risk
 * from this family: **a black plate covering the cutout goes down first**, and
 * the decor is drawn over it. Coverage is then guaranteed by construction and
 * the drawing only has to be nice.
 *
 * The size of that plate is the whole point and was nearly got wrong. Black
 * exactly over the hole hides the hole, in the sense that there is no longer a
 * boundary anywhere near it. What it does not hide is the *shape*: the black
 * then ends where the hole ends, so the wallpaper draws the cutout's outline
 * for it, in black, at full contrast. The other three families never meet this
 * because their black spans the screen. Here the plate has to stand off the
 * cutout by a margin the eye can see, and carry a radius of its own, so what
 * ends up on the glass is a plate that happens to contain a hole rather than a
 * hole with a highlighter round it.
 *
 * `verify` checks this on real pixels for every family.
 */
const BASE_MARGIN = 9;
/** Well under the island's 18.67: a stadium reads as the island, a box does not. */
const BASE_RADIUS = 12;

/** Same seed, same wallpaper. Mulberry32: short, fast, good enough for decor. */
function rng(seed: number) {
  let a = (seed >>> 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function black(): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color("#000000"));
  return p;
}

function stroke(width: number): SkPaint {
  const p = black();
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  p.setStrokeCap(StrokeCap.Round);
  return p;
}

export function drawDecor(canvas: SkCanvas, mask: DecorMask, g: Geometry) {
  canvas.drawRRect(basePlate(g), black());

  const random = rng(mask.seed);
  const d = Math.min(1, Math.max(0, mask.density));

  switch (mask.pattern) {
    case "rig":
      return drawRig(canvas, g, d, random);
    case "vine":
      return drawVine(canvas, g, d, random);
    case "garland":
      return drawGarland(canvas, g, d, random);
  }
}

/**
 * The plate, which every pattern is drawn on top of and `rig` also wears as its
 * ceiling rose. It runs off the top of the screen: above the cutout there is
 * nothing to stand off from, and stopping short there would draw a line.
 */
export function basePlate(g: Geometry) {
  const c = g.cutout;
  const top = Math.min(c.y - BASE_MARGIN, -4);
  return Skia.RRectXY(
    Skia.XYWHRect(c.x - BASE_MARGIN, top, c.w + BASE_MARGIN * 2, c.y + c.h + BASE_MARGIN - top),
    BASE_RADIUS,
    BASE_RADIUS,
  );
}

// -- Shared drawing ----------------------------------------------------------

type Pt = { x: number; y: number };

function cubicAt(a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return {
    x: w0 * a.x + w1 * b.x + w2 * c.x + w3 * d.x,
    y: w0 * a.y + w1 * b.y + w2 * c.y + w3 * d.y,
  };
}

function quad(a: number, b: number, c: number, t: number) {
  const u = 1 - t;
  return u * u * a + 2 * u * t * b + t * t * c;
}

/**
 * A stroke that thins as it goes. Skia has no tapered stroke, so the outline is
 * built by hand: walk the curve, step off each sample along the normal by half
 * the width there, then come back down the other side. A stem drawn at one
 * width is a wire, and at this size the eye reads the difference immediately.
 */
function tapered(pts: Pt[], from: number, to: number) {
  const b = Skia.PathBuilder.Make();
  const edge = (i: number, sign: number): Pt => {
    const a = pts[Math.max(i - 1, 0)];
    const c = pts[Math.min(i + 1, pts.length - 1)];
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const half = (from + (to - from) * (i / (pts.length - 1))) / 2;
    return {
      x: pts[i].x - (dy / len) * half * sign,
      y: pts[i].y + (dx / len) * half * sign,
    };
  };
  for (let i = 0; i < pts.length; i += 1) {
    const p = edge(i, 1);
    if (i === 0) {
      b.moveTo(p.x, p.y);
    } else {
      b.lineTo(p.x, p.y);
    }
  }
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = edge(i, -1);
    b.lineTo(p.x, p.y);
  }
  return b.close().detach();
}

/**
 * A leaf, anchored at its stalk and running along `angle`. Two quadratics
 * meeting end to end, so it is pointed where a leaf is pointed, which is the
 * one thing an ellipse can never be.
 */
function leaf(canvas: SkCanvas, at: Pt, len: number, wide: number, angle: number) {
  const path = Skia.PathBuilder.Make()
    .moveTo(0, 0)
    .quadTo(len / 2, -wide, len, 0)
    .quadTo(len / 2, wide, 0, 0)
    .close()
    .detach();
  canvas.save();
  canvas.translate(at.x, at.y);
  canvas.rotate((angle * 180) / Math.PI, 0, 0);
  canvas.drawPath(path, black());
  canvas.restore();
}

// -- The lamp ----------------------------------------------------------------

/**
 * A shade on a stem, which is the one everyday object whose natural shape is a
 * wide shallow trapezoid: exactly what a Dynamic Island needs covering with.
 */
function shade(cx: number, top: number, bottom: number, halfTop: number, halfBottom: number) {
  const h = bottom - top;
  const spread = halfBottom - halfTop;
  // Sides all but straight, with a fraction of a bow. Curving them hard makes
  // the foot flare out sideways and the thing becomes an anvil.
  const c1 = spread * 0.36;
  const c2 = spread * 0.72;
  // Seen from below, a shade's bottom rim is an ellipse and the nearest part of
  // it is the middle. That dip is the whole difference between a lampshade and
  // a trapezoid, and it costs one control point.
  const dip = halfBottom * 0.26;
  return Skia.PathBuilder.Make()
    .moveTo(cx - halfTop, top)
    .lineTo(cx + halfTop, top)
    .cubicTo(
      cx + halfTop + c1,
      top + h / 3,
      cx + halfTop + c2,
      top + (h * 2) / 3,
      cx + halfBottom,
      bottom,
    )
    .quadTo(cx, bottom + dip, cx - halfBottom, bottom)
    .cubicTo(
      cx - halfTop - c2,
      top + (h * 2) / 3,
      cx - halfTop - c1,
      top + h / 3,
      cx - halfTop,
      top,
    )
    .close()
    .detach();
}

function drawRig(canvas: SkCanvas, g: Geometry, d: number, random: () => number) {
  const c = g.cutout;
  const cx = c.x + c.w / 2;

  // The shade *is* the plate, widened. Hanging a narrower lamp under the plate
  // was the obvious thing and it is wrong: the plate then shows above it as a
  // box, and box plus lamp reads as a lamp that came with packaging. The plate
  // has to be the top of the shade, which means the shade meets the screen
  // edge, which is what a ceiling light does anyway.
  const plate = basePlate(g);
  const plateHalf = plate.rect.width / 2;
  const plateFoot = plate.rect.y + plate.rect.height;

  const halfTop = plateHalf;
  const flare = 1.3 + 0.3 * d + (random() - 0.5) * 0.14;
  const halfBottom = Math.min(plateHalf * flare, g.width / 2 - 14);
  const bottom = plateFoot + Math.max(12, halfBottom * 0.3) * (0.9 + random() * 0.25) + 18 * d;

  canvas.drawPath(shade(cx, plate.rect.y, bottom, halfTop, halfBottom), black());

  // A smaller lamp either side, on a cord, so the one over the cutout reads as
  // one of a set rather than as the thing that is hiding something. They come
  // in as a pair or not at all: one lamp off to the left is a mistake, and a
  // pair is a fixture. The room left beside the shade decides, not the density,
  // since on a notch the shade is already most of the screen and there is none.
  const room = cx - halfBottom - 14;
  if (d > 0.35 && room > 60) {
    const half = Math.min(room * 0.4, 34);
    const drop = 12 + random() * 18;
    for (const side of [-1, 1]) {
      // Centred in the free strip beside the shade, which starts at the screen
      // edge, not at the middle of the screen.
      const x = side < 0 ? room / 2 : g.width - room / 2;
      canvas.drawRect(Skia.XYWHRect(x - 2, -1, 4, drop + 2), black());
      canvas.drawPath(shade(x, drop, drop + half * 0.95, half * 0.42, half), black());
    }
  }
}

// -- The foliage -------------------------------------------------------------

/**
 * Leaves along the top edge, seen from underneath, with strands hanging out of
 * them.
 *
 * The cutout sits 11 pt from the top, so anything covering it occupies that
 * whole band whatever it is: the choice was never how much black, only what the
 * edge of the black looks like. A scalloped edge of leaf tips is the shape that
 * reads as a plant instead of as a band with a wavy bottom, and it is built as
 * one path so no sliver of the base can escape between two leaves.
 */
function drawVine(canvas: SkCanvas, g: Geometry, d: number, random: () => number) {
  const c = g.cutout;
  const cx = c.x + c.w / 2;
  const clear = c.w / 2 + 10;

  const halfSpan = clear + 52 + (g.width / 2 + 10 - clear - 52) * d;
  const deep = c.y + c.h + 16 + 24 * d;
  const x0 = cx - halfSpan;
  const x1 = cx + halfSpan;

  // The notches stay level across the cutout and only feather beyond it, so the
  // deepest part of the canopy is exactly where the covering has to happen and
  // the thinning out happens where nothing depends on it.
  const notch = (x: number) => {
    const t = Math.min(1, Math.max(0, (Math.abs(x - cx) - clear) / Math.max(halfSpan - clear, 1)));
    return deep * (0.1 + 0.9 * Math.cos((t * Math.PI) / 2) ** 1.1);
  };

  // Lobes of uneven width, each with its point off centre. Evenly spaced lobes
  // with centred points are a saw blade, and the eye names a saw blade far
  // faster than it names a leaf.
  const lobes = Math.max(5, Math.round((halfSpan * 2) / 34));
  const widths: number[] = [];
  let total = 0;
  for (let i = 0; i < lobes; i += 1) {
    const w = 0.72 + random() * 0.56;
    widths.push(w);
    total += w;
  }
  const edge = (i: number) => {
    let acc = 0;
    for (let k = 0; k < i; k += 1) {
      acc += widths[k];
    }
    return x0 + ((x1 - x0) * acc) / total;
  };

  const canopy = Skia.PathBuilder.Make().moveTo(x0, -4).lineTo(x1, -4).lineTo(x1, notch(x1));
  for (let i = lobes; i >= 1; i -= 1) {
    const xa = edge(i);
    const xb = edge(i - 1);
    const xm = xa + (xb - xa) * (0.36 + random() * 0.28);
    const ya = notch(xa);
    const yb = notch(xb);
    const tip = notch(xm) + (9 + 15 * d) * (0.7 + random() * 0.7);
    // The control sits far along in x and barely down in y, so the edge leaves
    // the notch almost level, bellies out, and only then turns into the point.
    // Halfway between notch and tip instead gives a straight line, which is the
    // sawtooth. The curve stays monotonic in y, so the notch is still the
    // highest the edge ever gets and the covering is untouched.
    canopy.quadTo(xa + (xm - xa) * 0.82, ya + (tip - ya) * 0.18, xm, tip);
    canopy.quadTo(xb + (xm - xb) * 0.82, yb + (tip - yb) * 0.18, xb, yb);
  }
  canvas.drawPath(canopy.close().detach(), black());

  // Strands hanging out of the canopy, beside the cutout rather than over it:
  // that part of the screen is the one this whole app exists to calm down.
  const strands = Math.round(1 + 3 * d);
  for (let i = 0; i < strands; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = cx + side * (clear + 16 + random() * Math.max(halfSpan - clear - 24, 10));
    const len = 44 + 80 * d * (0.5 + random() * 0.7);
    const sway = (random() - 0.5) * 34 + side * 16;
    if (x < 18 || x > g.width - 18) {
      continue;
    }

    const top = { x, y: notch(x) - 8 };
    const c1 = { x: x + sway * 0.3, y: top.y + len * 0.4 };
    const c2 = { x: x + sway, y: top.y + len * 0.75 };
    const end = { x: x + sway * 1.15, y: top.y + len };
    const pts: Pt[] = [];
    for (let k = 0; k <= 24; k += 1) {
      pts.push(cubicAt(top, c1, c2, end, k / 24));
    }
    canvas.drawPath(tapered(pts, 4.4, 1.4), black());

    const count = 2 + Math.round(3 * d);
    for (let k = 1; k <= count; k += 1) {
      const t = 0.22 + (k / (count + 1)) * 0.68;
      const size = (26 + 16 * d) * (1 - t * 0.35);
      const out = k % 2 === 0 ? 1 : -1;
      const angle = out > 0 ? 0.72 : Math.PI - 0.72;
      leaf(canvas, cubicAt(top, c1, c2, end, t), size, size * 0.34, angle + (random() - 0.5) * 0.4);
    }
    leaf(canvas, end, 22 + 12 * d, (22 + 12 * d) * 0.34, Math.PI / 2);
  }
}

// -- The garland -------------------------------------------------------------

/**
 * A cable sagging from both top corners, with a lantern where it hangs lowest
 * and bulbs along the rest of it.
 *
 * The sag is set so the low point lands on the cutout, which is what makes the
 * lantern's position look like a consequence of the cable rather than a place
 * chosen to hide something.
 */
function drawGarland(canvas: SkCanvas, g: Geometry, d: number, random: () => number) {
  const c = g.cutout;
  const cx = c.x + c.w / 2;

  const ax = -4;
  const bx = g.width + 4;
  // A quadratic reaches only halfway to its control point, so the control sits
  // at twice the sag. Its x is the midpoint of the two ends, which means x runs
  // linearly in t and a bulb can be placed by the x it should have.
  //
  // The sag stops at the middle of the cutout rather than under it. Deeper and
  // the cable meets the lantern at its widest point, which reads as a lantern
  // threaded on a wire; here it meets it up on the shoulder, which is where a
  // hanging thing is held.
  const sag = c.y + c.h * 0.5;
  const ctrl = 2 * sag + 1;
  canvas.drawPath(
    Skia.PathBuilder.Make()
      .moveTo(ax, -1)
      .quadTo((ax + bx) / 2, ctrl, bx, -1)
      .detach(),
    stroke(3.4),
  );

  // Wide enough at every height the cutout occupies, not just at the waist: the
  // shoulders of this shape are where the base would otherwise show its ears.
  // The height follows the width for the same reason the lampshade's does.
  const lw = c.w / 2 + 30 + 12 * d;
  const lh = Math.max(c.h + 26, lw * 0.72) + 12 * d;
  const top = c.y - 9;
  const foot = top + lh;
  const topHalf = lw * 0.44;
  const footHalf = lw * 0.5;
  // Flat top, flat foot, and sides that flare fast and then run nearly straight
  // down: that profile is a paper lantern. One smooth curve from top to foot is
  // an ellipse, and an ellipse this wide is an airship.
  canvas.drawPath(
    Skia.PathBuilder.Make()
      .moveTo(cx - topHalf, top)
      .lineTo(cx + topHalf, top)
      .cubicTo(cx + lw * 0.99, top + lh * 0.12, cx + lw, top + lh * 0.34, cx + lw, top + lh * 0.46)
      .cubicTo(cx + lw, top + lh * 0.66, cx + lw * 0.86, top + lh * 0.86, cx + footHalf, foot)
      .lineTo(cx - footHalf, foot)
      .cubicTo(cx - lw * 0.86, top + lh * 0.86, cx - lw, top + lh * 0.66, cx - lw, top + lh * 0.46)
      .cubicTo(cx - lw, top + lh * 0.34, cx - lw * 0.99, top + lh * 0.12, cx - topHalf, top)
      .close()
      .detach(),
    black(),
  );
  // The cap is above the screen edge on most devices, so the whole job of
  // saying "lantern" rather than "shape" falls to the foot: a plate wider than
  // the opening, a short drop, a bead.
  canvas.drawRRect(
    Skia.RRectXY(Skia.XYWHRect(cx - footHalf * 1.12, foot - 3, footHalf * 2.24, 9), 4, 4),
    black(),
  );
  canvas.drawRect(Skia.XYWHRect(cx - 3, foot + 5, 6, 8), black());
  canvas.drawCircle(cx, foot + 16, 5.5, black());

  // Bulbs along the cable, hanging from a small cap, smaller as they climb away
  // from the low point. They start clear of the lantern so both stay readable.
  const perSide = 1 + Math.round(3 * d);
  for (let i = 0; i < perSide; i += 1) {
    for (const side of [-1, 1]) {
      const x = cx + side * (lw + 22 + i * 38);
      const r = (8.5 - i * 1.1) * (0.72 + 0.28 * d) * (0.88 + random() * 0.24);
      if (x < 14 || x > g.width - 14 || r < 3) {
        continue;
      }
      const y = quad(-1, ctrl, -1, (x - ax) / (bx - ax));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - 4.5, y - 1, 9, 6), 2.5, 2.5), black());
      canvas.drawCircle(x, y + 6 + r, r, black());
    }
  }
}

export const DECOR_PATTERNS: DecorPattern[] = ["rig", "vine", "garland"];
