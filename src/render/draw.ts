import {
  ClipOp,
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  type SkCanvas,
  type SkImage,
  type SkPaint,
  type SkShader,
} from "@shopify/react-native-skia";

import { ISLAND, maskFloor, maskLimit, screenCorner, type Geometry } from "../geometry/devices";
import { MESH_MAX, type Mask, type Recipe, type Source } from "../recipe/types";
import { paletteById } from "./palettes";
import { fadeEffect, meshEffect } from "./shaders";

/**
 * Foundation B, rendering.
 *
 * One function draws the recipe, **always in points**. The preview plays it at
 * scale 1, the export applies `canvas.scale(density)` before calling it. Parity
 * between preview and export is structural rather than watched: there is only
 * one drawing path.
 */
export type DrawContext = {
  recipe: Recipe;
  geometry: Geometry;
  /** The already decoded source image, when the source is a photo. */
  image: SkImage | null;
};

export function drawRecipe(canvas: SkCanvas, ctx: DrawContext) {
  const source = sourceShader(ctx.recipe.source, ctx.geometry, ctx.image);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(source);
  canvas.drawRect(Skia.XYWHRect(0, 0, ctx.geometry.width, ctx.geometry.height), paint);

  drawMask(canvas, ctx.recipe.mask, ctx.geometry, source);
}

/**
 * The same wallpaper twice, with the effect on one side only.
 *
 * **Preview only, and deliberately in this file.** It is the recipe drawn
 * against itself: the source on the left as the phone would have shown it, the
 * whole recipe on the right, and a seam where the two meet. Nothing new is
 * drawn and nothing is simulated, which is the only reason it is allowed to
 * exist beside `drawRecipe`: the same shader, the same mask, one clip.
 *
 * The export never calls it. What is saved is the recipe, and half a recipe is
 * not a wallpaper.
 *
 * This used to be done by the store compositor, from two offscreen renders
 * pasted together. Doing it here means the comparison can be photographed
 * through the real app, with the real interface over it, which is both a better
 * screenshot and one fewer thing that can drift from what the app does.
 */
export function drawCompare(canvas: SkCanvas, ctx: DrawContext, at = 0.5) {
  const { width, height } = ctx.geometry;
  const source = sourceShader(ctx.recipe.source, ctx.geometry, ctx.image);

  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(source);
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint);

  const seam = width * at;
  canvas.save();
  canvas.clipRect(Skia.XYWHRect(seam, 0, width - seam, height), ClipOp.Intersect, false);
  drawMask(canvas, ctx.recipe.mask, ctx.geometry, source);
  canvas.restore();

  // Thin, and not quite white: a hard white rule reads as a divider between two
  // pictures rather than as one picture with a line drawn on it.
  const rule = Skia.Paint();
  rule.setColor(Skia.Color("rgba(255,255,255,0.85)"));
  canvas.drawRect(Skia.XYWHRect(seam - 1, 0, 2, height), rule);
}

// -- Source ------------------------------------------------------------------

/**
 * The source is produced as a **shader**, not as a drawing.
 *
 * That is what lets the fade take it as an input and compute the final colour
 * itself, instead of compositing translucent black on top (see `shaders.ts`).
 * Background and fade therefore share the exact same definition of the source,
 * so they cannot drift apart.
 */
export function sourceShader(source: Source, g: Geometry, image: SkImage | null): SkShader {
  if (source.type === "photo" && image) {
    const fit = coverRect(image.width(), image.height(), g.width, g.height, source);
    const m = Skia.Matrix();
    m.translate(fit.x, fit.y);
    m.scale(fit.w / image.width(), fit.h / image.height());
    return image.makeShaderOptions(
      TileMode.Clamp,
      TileMode.Clamp,
      FilterMode.Linear,
      MipmapMode.Linear,
      m,
    );
  }

  // No photo: the gradient. It also stands in while an image is being decoded,
  // so the screen is never empty.
  const points = (source.type === "gradient" ? source.points : paletteById("aurora").points).slice(
    0,
    MESH_MAX,
  );

  if (!meshEffect || points.length === 0) {
    // Without the shader, the two end colours down the screen. It bands and it
    // is not the composition, but a flawed gradient beats a blank screen.
    const ends = points.length ? points : paletteById("aurora").points;
    return Skia.Shader.MakeLinearGradient(
      { x: 0, y: 0 },
      { x: 0, y: g.height },
      [Skia.Color(ends[0].color), Skia.Color(ends[ends.length - 1].color)],
      null,
      TileMode.Clamp,
    );
  }

  // Flat, in declaration order: two for the size, the count, the scale, then
  // the two float4 arrays. float4 rather than float2 and float3 because an
  // array of those is where uniform packing rules stop being obvious.
  const uniforms: number[] = [g.width, g.height, points.length, g.scale];
  for (let i = 0; i < MESH_MAX; i += 1) {
    const p = points[i];
    uniforms.push(p ? p.x : 0, p ? p.y : 0, 0, 0);
  }
  for (let i = 0; i < MESH_MAX; i += 1) {
    const lin = linearRgb(points[i]?.color ?? "#000000");
    uniforms.push(lin[0], lin[1], lin[2], 1);
  }
  return meshEffect.makeShader(uniforms);
}

/** `#RRGGBB` to linear light, which is where the gradient is mixed. */
function linearRgb(hex: string): [number, number, number] {
  const at = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    return Math.pow((Number.isNaN(v) ? 0 : v) / 255, 2.2);
  };
  return [at(0), at(1), at(2)];
}

/**
 * As far in as a photo may be pushed.
 *
 * Past four times, a phone photo is being enlarged rather than framed: the
 * result is a wallpaper made of pixels rather than of a picture, and there is
 * nothing to be gained by letting the pinch go there.
 */
export const ZOOM_MAX = 4;

/**
 * The framing, made legal.
 *
 * The zoom is held between covering the screen and `ZOOM_MAX`, and the offset
 * is clamped to the slack that zoom leaves, so no edge of the image can enter
 * the frame: an edge means a hole under the cutout, and the whole thing rests
 * on there being no hole.
 *
 * The gesture stores what this returns rather than what the finger asked for.
 * Keeping the raw value would let an offset run away past the edge and come
 * back dead for as long as it took to wind in.
 */
export function clampFraming(
  iw: number,
  ih: number,
  W: number,
  H: number,
  s: { dx: number; dy: number; zoom: number },
) {
  const zoom = Math.min(ZOOM_MAX, Math.max(1, s.zoom));
  const scale = Math.max(W / iw, H / ih) * zoom;
  const slackX = Math.max(0, (iw * scale - W) / 2);
  const slackY = Math.max(0, (ih * scale - H) / 2);
  return {
    zoom,
    dx: Math.min(slackX, Math.max(-slackX, s.dx)),
    dy: Math.min(slackY, Math.max(-slackY, s.dy)),
  };
}

/**
 * Cover framing: the image always fills the screen, whatever the zoom and
 * offset, because the framing is clamped before it is used.
 */
export function coverRect(
  iw: number,
  ih: number,
  W: number,
  H: number,
  s: { dx: number; dy: number; zoom: number },
) {
  const { dx, dy, zoom } = clampFraming(iw, ih, W, H, s);
  const scale = Math.max(W / iw, H / ih) * zoom;
  const w = iw * scale;
  const h = ih * scale;
  return { x: (W - w) / 2 + dx, y: (H - h) / 2 + dy, w, h };
}

// -- Masks -------------------------------------------------------------------

function black() {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color("#000000"));
  return p;
}

/** For a rectangle that shares an edge with another one. See `drawFade`. */
function aliased(p: SkPaint) {
  p.setAntiAlias(false);
  return p;
}

function drawMask(canvas: SkCanvas, mask: Mask, g: Geometry, source: SkShader) {
  switch (mask.type) {
    case "bar":
      return drawBar(canvas, mask.height, mask.corner, g);
    case "stripes":
      return drawStripes(canvas, mask, g);
    case "fade":
      return drawFade(canvas, mask, g, source);
  }
}

/**
 * How far the bar can be dragged.
 *
 * Past a sixteenth of the screen the bar stops being a way to hide the cutout
 * and becomes a letterbox: there is nothing to gain above it, and every point
 * of height is a point of wallpaper lost.
 */
export const BAR_MAX_FRACTION = 1 / 16;

/**
 * The shortest bar the slider offers, which is not always a safe one.
 *
 * It is `maskLimit`, not the floor: on a phone whose hole was measured they are
 * the same number, and on one whose hole was read off a table the slider goes a
 * little under, on purpose. That is the only way anyone can find out where the
 * hole really ends, and the only way a mask on an unrecognised phone stops
 * being needlessly tall.
 */
export function barMinHeight(g: Geometry): number {
  return maskLimit(g);
}

/**
 * A sixteenth of the screen, or a little above the cutout, whichever is more.
 *
 * A sixteenth is about 53 pt on a current iPhone, and the bottom of the Dynamic
 * Island is already at 48: taken literally the setting would have five points
 * of travel and the slider would be furniture. The floor cannot come down,
 * since anything shorter stops covering the cutout, so the ceiling gets the
 * 24 pt that keeps the control a control.
 */
export function barMaxHeight(g: Geometry): number {
  return Math.max(g.height * BAR_MAX_FRACTION, barMinHeight(g) + 24);
}

/**
 * The corner radius, from the cutout's own radius to the display's own.
 *
 * It used to be derived from the height, and clamped to half of it. Both were
 * wrong. Derived, it could not be judged separately from the height even though
 * it plainly is a separate judgement. Clamped, it could never reach the display
 * corner on a short band, which is exactly where it matters: the fillet hangs
 * *below* the band line, so its size has nothing to do with the band's height.
 * The only real constraint is that the two arcs do not meet in the middle.
 */
export function barRadius(corner: number, g: Geometry): number {
  if (g.kind === "none") {
    return 0;
  }
  const t = Math.min(1, Math.max(0, corner));
  return Math.min(ISLAND.r + t * (screenCorner(g) - ISLAND.r), g.width / 2);
}

/**
 * 01, solid bar.
 *
 * The corners are **inverted**. A plain rounded rectangle curves its bottom
 * corners upward, away from the screen edges, and the bar then reads as a black
 * card placed on the wallpaper. The cutout itself does the opposite where it
 * meets the top edge: the black runs further down at the sides and curves back
 * in. Following that gives a bar that reads as panel rather than as overlay.
 *
 * So the outline is a rectangle whose bottom edge sinks by `r` at each end,
 * joined to the bar line by a quarter circle turning the other way.
 */
function drawBar(canvas: SkCanvas, height: number, corner: number, g: Geometry) {
  const r = barRadius(corner, g);
  if (r <= 0) {
    canvas.drawRect(Skia.XYWHRect(0, 0, g.width, height), black());
    return;
  }

  const W = g.width;
  const path = Skia.PathBuilder.Make()
    // Starting above the top edge keeps the join with the screen border clean at
    // any density, since nothing is drawn exactly on row zero.
    .moveTo(0, -1)
    .lineTo(W, -1)
    .lineTo(W, height + r)
    // Right corner: from (W, height + r) round to (W - r, height).
    .arcToOval(Skia.XYWHRect(W - 2 * r, height, 2 * r, 2 * r), 0, -90, false)
    .lineTo(r, height)
    // Left corner: from (r, height) round to (0, height + r).
    .arcToOval(Skia.XYWHRect(0, height, 2 * r, 2 * r), 270, -90, false)
    .close()
    .detach();

  canvas.drawPath(path, black());
}

/**
 * Where the stripes start: below a head band forced to contain the cutout.
 *
 * The floor and nothing added to it, which is where the bar's own default
 * stops. It used to be six points lower, from when the floor was the safe area
 * and needed no margin of its own; now that the floor is the hole plus what a
 * table entry is worth, the six were a second margin on top of a first, and the
 * pattern visibly started later than the bar did on the same phone.
 */
export function stripeHead(g: Geometry): number {
  return Math.max(maskFloor(g), 8);
}

/** How far down the screen the pattern runs. */
const STRIPE_SPAN = 0.42;
/** The grid opens downward, which is what gives the pattern its direction. */
const STRIPE_GROWTH = 1.09;
/**
 * Coverage of the first band, as a fraction of its period.
 *
 * It was 0.85, which left a five point slit at the head: too thin to register
 * as the pattern beginning, so the black read as carrying on and the family
 * looked like it started ten points below the bar on the same phone. At 0.68
 * the first gap is twice that and the rhythm announces itself where it starts.
 */
const STRIPE_START_COVER = 0.68;
/**
 * 2.2 because the eye integrates the bands spatially: mean luminance is
 * `1 - coverage`, and lightness goes as luminance to the power 1/2.2. Ramping
 * the coverage on that law is what makes the dissolve look even instead of
 * dropping off a cliff halfway down, exactly as in the fade shader.
 */
const STRIPE_GAMMA = 2.2;
/** No slit of wallpaper thinner than this: below it, it reads as a seam. */
const STRIPE_MIN_GAP = 5;
/** No band thinner than this: below it, it reads as a scanline. */
const STRIPE_MIN_BAND = 1;

export type StripeBand = { y: number; h: number };

/**
 * The bands, from the one number the user sets.
 *
 * The previous version ran two independent geometric series, one shrinking the
 * bands and one growing the gaps. They drift apart: by the fifth band the
 * period had more than doubled while the band had halved, so the eye never
 * found a rhythm and the tail was a scatter of hairlines that simply stopped.
 *
 * This is a halftone ramp instead. The bands sit on one grid, so there is a
 * rhythm; the coverage falls from `STRIPE_START_COVER` to zero along that grid,
 * so the pattern dissolves rather than stopping; and the grid itself opens
 * gently downward, which gives the dissolve a direction.
 *
 * Density then means one thing only: how fine the pattern is. Coarse and
 * graphic at 0, close to a dither at 1. Neither end is wrong, which is the
 * point of there being a single control.
 */
export function stripeBands(density: number, g: Geometry): StripeBand[] {
  const d = Math.min(1, Math.max(0, density));
  const count = Math.round(7 + 6 * d);
  const span = g.height * STRIPE_SPAN;
  // A geometric grid summing to `span`.
  const first = (span * (STRIPE_GROWTH - 1)) / (Math.pow(STRIPE_GROWTH, count) - 1);

  // The starting coverage is capped so the first slit of wallpaper is at least
  // `STRIPE_MIN_GAP`, and it is capped *once*, here, rather than per band.
  // Clamping each band instead lets the clamp bind on the first few, and since
  // the grid grows those bands come out thicker than the one above: the pattern
  // reads as swelling before it dissolves, which is exactly what it must not do.
  const startCover = Math.min(STRIPE_START_COVER, 1 - STRIPE_MIN_GAP / first);
  if (startCover <= 0) {
    return [];
  }

  const bands: StripeBand[] = [];
  let y = stripeHead(g);
  let period = first;

  for (let i = 0; i < count; i += 1) {
    const h = startCover * Math.pow(1 - i / count, STRIPE_GAMMA) * period;
    y += period - h;
    if (h >= STRIPE_MIN_BAND) {
      bands.push({ y, h });
    }
    y += h;
    period *= STRIPE_GROWTH;
  }

  return bands;
}

/**
 * 11, decaying stripes. Lines only.
 *
 * The geometry does not start at the top of the screen but at the cutout: the
 * head band is forced to contain it and everything else follows from there.
 */
function drawStripes(canvas: SkCanvas, mask: { density: number }, g: Geometry) {
  const paint = black();
  canvas.drawRect(Skia.XYWHRect(0, 0, g.width, stripeHead(g)), paint);

  for (const band of stripeBands(mask.density, g)) {
    canvas.drawRect(Skia.XYWHRect(0, band.y, g.width, band.h), paint);
  }
}

/**
 * Where the absolute black ends, which is not a setting.
 *
 * It has one correct place, just under the cutout, and a handle for it could
 * only be dragged to somewhere worse. That place is the floor, the same line
 * the bar's default stops at and the same line the stripes start from: three
 * families, one edge, so choosing between them is choosing a texture and never
 * a height.
 *
 * It used to be four points lower, from when the floor was the safe area and
 * the four were the margin the safe area did not need. The floor carries its
 * own margin now, and a margin on a margin is how the fade came to start a
 * visible step below the bar on the same phone.
 */
export function fadeSolidEnd(g: Geometry): number {
  return maskFloor(g);
}

/** 03, dithered fade. See `shaders.ts` for why it needs a shader. */
function drawFade(
  canvas: SkCanvas,
  mask: { fadeEnd: number; curve: 0 | 1 | 2 },
  g: Geometry,
  source: SkShader,
) {
  const solidEnd = fadeSolidEnd(g);

  // Absolute black above `solidEnd` is painted separately: the shader only
  // handles the transition, and this band must never be dithered.
  //
  // Neither half is anti aliased, and that is the point. They are axis aligned
  // rectangles sharing an edge, and that edge lands on half a device row more
  // often than not: 44 points on a 2.625 screen is 115.5 pixels. Anti aliased,
  // each covers half of that row, and half of black over half of black leaves a
  // quarter of the wallpaper showing through. It reads as a bright hairline
  // ruled across the top of the screen, and it was in every thumbnail too,
  // where the scale is smaller and the same quarter is a larger part of what
  // you see. Without it both rectangles snap to the same row and the seam
  // cannot exist.
  canvas.drawRect(Skia.XYWHRect(0, 0, g.width, solidEnd), aliased(black()));

  const span = Math.max(0, mask.fadeEnd - solidEnd);
  if (span <= 0) {
    return;
  }

  if (!fadeEffect) {
    // Fallback without a shader: a plain Skia gradient. It will band, but a
    // flawed fade beats a broken screen.
    const p = Skia.Paint();
    p.setShader(
      Skia.Shader.MakeLinearGradient(
        { x: 0, y: solidEnd },
        { x: 0, y: mask.fadeEnd },
        [Skia.Color("#000000"), Skia.Color("#00000000")],
        null,
        TileMode.Clamp,
      ),
    );
    canvas.drawRect(Skia.XYWHRect(0, solidEnd, g.width, span), aliased(p));
    return;
  }

  const paint = Skia.Paint();
  paint.setShader(
    fadeEffect.makeShaderWithChildren([solidEnd, mask.fadeEnd, mask.curve, g.scale], [source]),
  );
  canvas.drawRect(Skia.XYWHRect(0, solidEnd, g.width, span), aliased(paint));
}
