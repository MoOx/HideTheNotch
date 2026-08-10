import {
  BlendMode,
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  type SkCanvas,
  type SkImage,
  type SkShader,
} from "@shopify/react-native-skia";

import { cutoutBottom, ISLAND, screenCorner, type Geometry } from "../geometry/devices";
import type { Mask, Recipe, Source } from "../recipe/types";
import { paletteById } from "./palettes";
import { fadeEffect } from "./shaders";

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
      m
    );
  }

  // No photo: a procedural gradient. It also serves as a fallback while the
  // image is being decoded, so the screen is never empty.
  const palette = paletteById(source.type === "gradient" ? source.preset : "aurora");

  const base = Skia.Shader.MakeLinearGradient(
    { x: g.width * 0.15, y: 0 },
    { x: g.width * 0.85, y: g.height },
    palette.stops.map((c) => Skia.Color(c)),
    null,
    TileMode.Clamp
  );

  const halo = Skia.Shader.MakeRadialGradient(
    { x: g.width * 0.72, y: g.height * 0.24 },
    g.width * 0.9,
    [Skia.Color(palette.halo + "70"), Skia.Color("#00000000")],
    null,
    TileMode.Clamp
  );

  return Skia.Shader.MakeBlend(BlendMode.SrcOver, halo, base);
}

/**
 * Cover framing: the image always fills the screen, whatever the zoom and
 * offset. The offset is clamped so no edge enters the frame, which would leave
 * a hole under the cutout.
 */
export function coverRect(
  iw: number,
  ih: number,
  W: number,
  H: number,
  s: { dx: number; dy: number; zoom: number }
) {
  const base = Math.max(W / iw, H / ih);
  const scale = base * Math.max(s.zoom, 1);
  const w = iw * scale;
  const h = ih * scale;
  const slackX = Math.max(0, (w - W) / 2);
  const slackY = Math.max(0, (h - H) / 2);
  const dx = Math.min(slackX, Math.max(-slackX, s.dx));
  const dy = Math.min(slackY, Math.max(-slackY, s.dy));
  return { x: (W - w) / 2 + dx, y: (H - h) / 2 + dy, w, h };
}

// -- Masks -------------------------------------------------------------------

function black() {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color("#000000"));
  return p;
}

function drawMask(canvas: SkCanvas, mask: Mask, g: Geometry, source: SkShader) {
  switch (mask.type) {
    case "bar":
      return drawBar(canvas, mask.height, g);
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

export function barMinHeight(g: Geometry): number {
  return Math.max(cutoutBottom(g), 1);
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
 * The corner radius is not a setting: it follows the height.
 *
 * At the bottom of the range the bar is barely taller than the cutout, and a
 * tight radius makes it read as an extension of the hardware. As it grows it
 * stops being a cutout cover and becomes a band across the screen, and a band
 * that meets the edge squarely looks wrong next to a display whose own corners
 * are round. So the radius opens up towards the display's own corner radius,
 * and the shape stays of a piece with the panel at either end.
 */
export function barRadius(height: number, g: Geometry): number {
  if (g.kind === "none") {
    return 0;
  }
  const min = barMinHeight(g);
  const max = barMaxHeight(g);
  const t = Math.min(1, Math.max(0, (height - min) / (max - min)));
  const r = ISLAND.r + t * (screenCorner(g) - ISLAND.r);
  // The arc has to fit: it descends by r at the edges, and the two of them must
  // not meet in the middle.
  return Math.min(r, height / 2, g.width / 2);
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
function drawBar(canvas: SkCanvas, height: number, g: Geometry) {
  const r = barRadius(height, g);
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
 */
export function stripeHead(g: Geometry): number {
  return Math.max(g.cutout.y + g.cutout.h + 6, 8);
}

/** How far down the screen the pattern runs. */
const STRIPE_SPAN = 0.42;
/** The grid opens downward, which is what gives the pattern its direction. */
const STRIPE_GROWTH = 1.09;
/** Coverage of the first band, as a fraction of its period. */
const STRIPE_START_COVER = 0.85;
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
 * It has one correct place, just under the cutout, and a handle for it can only
 * be dragged to somewhere worse. On an island the safe area matters more than
 * the cutout itself, otherwise a strip of photo stays stranded beside the
 * status bar.
 */
export function fadeSolidEnd(g: Geometry): number {
  return Math.max(cutoutBottom(g) + 4, g.kind === "island" ? g.insetTop : 0, 1);
}

/** 03, dithered fade. See `shaders.ts` for why it needs a shader. */
function drawFade(
  canvas: SkCanvas,
  mask: { fadeEnd: number; curve: 0 | 1 | 2 },
  g: Geometry,
  source: SkShader
) {
  const solidEnd = fadeSolidEnd(g);

  // Absolute black above `solidEnd` is painted separately: the shader only
  // handles the transition, and this band must never be dithered.
  canvas.drawRect(Skia.XYWHRect(0, 0, g.width, solidEnd), black());

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
        TileMode.Clamp
      )
    );
    canvas.drawRect(Skia.XYWHRect(0, solidEnd, g.width, span), p);
    return;
  }

  const paint = Skia.Paint();
  paint.setShader(
    fadeEffect.makeShaderWithChildren(
      [solidEnd, mask.fadeEnd, mask.curve, g.scale],
      [source]
    )
  );
  canvas.drawRect(Skia.XYWHRect(0, solidEnd, g.width, span), paint);
}
