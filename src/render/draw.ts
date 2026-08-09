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

import { cutoutBottom, ISLAND, type Geometry } from "../geometry/devices";
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
 * The corner radius is not a setting.
 *
 * It starts matched to the island radius, so the bar reads as an extension of
 * the hardware, and eases down slightly as the bar grows: on a tall bar a large
 * flare starts reading as a shape laid on top of the wallpaper instead of as
 * part of the panel.
 */
export function barRadius(height: number, g: Geometry): number {
  if (g.kind === "none") {
    return 0;
  }
  const floor = Math.max(cutoutBottom(g), 1);
  const t = Math.min(1, Math.max(0, (height - floor) / Math.max(g.height * 0.32, 1)));
  return Math.min(ISLAND.r * (1 - 0.3 * t), height / 2);
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
 * The two numbers the stripes actually need, from the one the user sets.
 *
 * The pairing is the whole design of this family. Turning it up has to make the
 * pattern bolder *and* slower to die, because the two failures are at opposite
 * corners of the square: thin bands that decay slowly look like a printing
 * fault, thick bands that decay slowly are just a black screen. Moving along
 * this line, neither happens.
 *
 * The floor on the band height is what keeps the second band, the one right
 * under the cutout, from collapsing into a hairline.
 */
export function stripeGeometry(density: number) {
  const d = Math.min(1, Math.max(0, density));
  return { period: 14 + 20 * d, decay: 0.62 - 0.22 * d };
}

/**
 * 11, decaying stripes. Lines only.
 *
 * The geometry does not start at the top of the screen but at the cutout: the
 * first band is forced to contain it and everything else follows from there.
 */
function drawStripes(canvas: SkCanvas, mask: { density: number }, g: Geometry) {
  const paint = black();
  const head = Math.max(g.cutout.y + g.cutout.h + 6, 8);
  canvas.drawRect(Skia.XYWHRect(0, 0, g.width, head), paint);

  const { period, decay } = stripeGeometry(mask.density);
  const shrink = 1 - 0.55 * decay;
  const grow = 1 + 0.55 * decay;

  let y = head;
  let h = period;
  let gap = period * 0.42;

  for (let i = 0; i < 24 && y < g.height * 0.62 && h > 1.2; i += 1) {
    y += gap;
    canvas.drawRect(Skia.XYWHRect(0, y, g.width, h), paint);
    y += h;
    h *= shrink;
    gap *= grow;
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
