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

import type { Geometry } from "../geometry/devices";
import type { Mask, Recipe, Source } from "../recipe/types";
import { paletteById } from "./palettes";
import { fadeEffect } from "./shaders";

/**
 * Socle B — le rendu.
 *
 * Une seule fonction dessine la recette, **toujours en points**. L'aperçu la
 * joue à l'échelle 1, l'export applique `canvas.scale(densité)` avant de
 * l'appeler. La parité aperçu / export est structurelle, pas surveillée : il
 * n'y a qu'un chemin de dessin.
 */
export type DrawContext = {
  recipe: Recipe;
  geometry: Geometry;
  /** L'image source déjà décodée, quand la source est une photo. */
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

// ── Source ──────────────────────────────────────────────────────────────────

/**
 * La source est produite comme un **shader**, pas comme un dessin.
 *
 * C'est ce qui permet au fondu de la recevoir en entrée et de calculer la
 * couleur finale lui-même, au lieu de poser du noir semi-transparent par-dessus
 * (cf. `shaders.ts`). Le fond et le fondu partagent donc exactement la même
 * définition de la source : aucune divergence possible.
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

  // Pas de photo : un dégradé procédural. Sert aussi de repli tant que l'image
  // n'est pas décodée, pour ne jamais afficher un écran vide.
  const palette = paletteById(source.type === "gradient" ? source.preset : "aurore");

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
 * Cadrage « couvrir » : l'image remplit toujours l'écran, quels que soient le
 * zoom et le décalage. Le décalage est borné pour qu'aucun bord ne rentre dans
 * le cadre — ce qui laisserait un trou sous la découpe.
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

// ── Masques ─────────────────────────────────────────────────────────────────

function black() {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color("#000000"));
  return p;
}

function drawMask(canvas: SkCanvas, mask: Mask, g: Geometry, source: SkShader) {
  switch (mask.type) {
    case "bar":
      return drawBar(canvas, mask.height, mask.radius, g);
    case "stripes":
      return drawStripes(canvas, mask, g);
    case "fade":
      return drawFade(canvas, mask, g, source);
  }
}

/**
 * 01 · Bandeau plein. Les coins hauts sont arrondis eux aussi, mais placés
 * au-dessus du bord de l'écran : seuls les coins bas se voient.
 */
function drawBar(canvas: SkCanvas, height: number, radius: number, g: Geometry) {
  const r = Math.max(0, Math.min(radius, height / 2));
  const rect = Skia.XYWHRect(0, -r - 1, g.width, height + r + 1);
  canvas.drawRRect(Skia.RRectXY(rect, r, r), black());
}

/**
 * 11 · Trame dégressive. La géométrie ne part pas du haut de l'écran mais de la
 * découpe : la première bande est forcée à la contenir, tout le reste en dérive.
 */
function drawStripes(
  canvas: SkCanvas,
  mask: { variant: "lines" | "grid" | "dots"; period: number; decay: number },
  g: Geometry
) {
  const paint = black();
  const head = Math.max(g.cutout.y + g.cutout.h + 6, 8);
  canvas.drawRect(Skia.XYWHRect(0, 0, g.width, head), paint);

  const shrink = 1 - 0.55 * mask.decay;
  const grow = 1 + 0.55 * mask.decay;

  let y = head;
  let h = mask.period;
  let gap = mask.period * 0.42;

  for (let i = 0; i < 24 && y < g.height * 0.62 && h > 1.2; i += 1) {
    y += gap;
    if (mask.variant === "dots") {
      const r = h / 2;
      const step = r * 2.6;
      for (let x = step / 2; x < g.width + step; x += step) {
        canvas.drawCircle(x, y + r, r, paint);
      }
    } else if (mask.variant === "grid") {
      const cell = g.width / 6;
      for (let c = 0; c < 6; c += 1) {
        canvas.drawRect(Skia.XYWHRect(c * cell + cell * 0.08, y, cell * 0.84, h), paint);
      }
    } else {
      canvas.drawRect(Skia.XYWHRect(0, y, g.width, h), paint);
    }
    y += h;
    h *= shrink;
    gap *= grow;
  }
}

/** 03 · Fondu dithéré. Voir `shaders.ts` pour le pourquoi du shader. */
function drawFade(
  canvas: SkCanvas,
  mask: { solidEnd: number; fadeEnd: number; curve: 0 | 1 | 2 },
  g: Geometry,
  source: SkShader
) {
  // Le noir absolu au-dessus de `solidEnd` est peint séparément : le shader ne
  // traite que la transition, et cette bande ne doit jamais être dithérée.
  canvas.drawRect(Skia.XYWHRect(0, 0, g.width, mask.solidEnd), black());

  const span = Math.max(0, mask.fadeEnd - mask.solidEnd);
  if (span <= 0) {
    return;
  }

  if (!fadeEffect) {
    // Repli sans shader : dégradé Skia standard. Il fera du banding, mais mieux
    // vaut un fondu imparfait qu'un écran cassé.
    const p = Skia.Paint();
    p.setShader(
      Skia.Shader.MakeLinearGradient(
        { x: 0, y: mask.solidEnd },
        { x: 0, y: mask.fadeEnd },
        [Skia.Color("#000000"), Skia.Color("#00000000")],
        null,
        TileMode.Clamp
      )
    );
    canvas.drawRect(Skia.XYWHRect(0, mask.solidEnd, g.width, span), p);
    return;
  }

  const paint = Skia.Paint();
  paint.setShader(
    fadeEffect.makeShaderWithChildren(
      [mask.solidEnd, mask.fadeEnd, mask.curve, g.scale],
      [source]
    )
  );
  canvas.drawRect(Skia.XYWHRect(0, mask.solidEnd, g.width, span), paint);
}
