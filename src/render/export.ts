import { ImageFormat, Skia } from "@shopify/react-native-skia";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";

import { drawRecipe, type DrawContext } from "./draw";

export type ExportResult = {
  uri: string;
  widthPx: number;
  heightPx: number;
  bytes: number;
};

/**
 * Rend la recette hors écran, à la résolution physique de l'appareil cible.
 *
 * C'est la différence de fond avec la v1 de 2017, qui photographiait l'arbre de
 * vues : ici la photo source est échantillonnée à la résolution finale, pas
 * réduite à celle de l'écran avant capture. Et rien n'oblige la cible à être le
 * téléphone qu'on tient — d'où l'export pour un autre appareil.
 *
 * PNG obligatoire : le JPEG produit des artefacts de bloc à la frontière entre
 * le noir et l'image, ce qui fait précisément réapparaître la découpe.
 */
export function renderToFile(ctx: DrawContext): ExportResult {
  const { width, height, scale } = ctx.geometry;
  const wPx = Math.round(width * scale);
  const hPx = Math.round(height * scale);

  const surface = Skia.Surface.MakeOffscreen(wPx, hPx) ?? Skia.Surface.Make(wPx, hPx);
  if (!surface) {
    throw new Error(`Surface hors écran impossible en ${wPx}×${hPx}`);
  }

  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color("#000000"));
  // Le dessin est écrit en points ; on change d'échelle, pas de code.
  canvas.scale(scale, scale);
  drawRecipe(canvas, ctx);
  surface.flush();

  const snapshot = surface.makeImageSnapshot();
  const bytes = snapshot.encodeToBytes(ImageFormat.PNG, 100);
  if (!bytes) {
    throw new Error("Encodage PNG impossible");
  }

  const file = new File(Paths.cache, `HideTheNotch-${wPx}x${hPx}-${Date.now()}.png`);
  file.create({ overwrite: true });
  file.write(bytes);

  return { uri: file.uri, widthPx: wPx, heightPx: hPx, bytes: bytes.byteLength };
}

export type SaveOutcome =
  | { ok: true; result: ExportResult }
  | { ok: false; reason: "permission" | "error"; message?: string };

export async function saveToPhotos(ctx: DrawContext): Promise<SaveOutcome> {
  try {
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) {
      return { ok: false, reason: "permission" };
    }
    const result = renderToFile(ctx);
    await MediaLibrary.saveToLibraryAsync(result.uri);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
