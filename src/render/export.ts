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
 * Renders the recipe offscreen, at the physical resolution of the target
 * device.
 *
 * This is the substantive difference from the 2017 version, which photographed
 * the view tree: here the source photo is sampled at the final resolution
 * rather than being shrunk to screen size before capture. And nothing forces
 * the target to be the phone in your hand, hence exporting for another device.
 *
 * PNG is mandatory: JPEG produces block artefacts at the boundary between the
 * black and the image, which is precisely what makes the cutout reappear.
 */
export function renderToFile(ctx: DrawContext): ExportResult {
  const { width, height, scale } = ctx.geometry;
  const wPx = Math.round(width * scale);
  const hPx = Math.round(height * scale);

  const surface = Skia.Surface.MakeOffscreen(wPx, hPx) ?? Skia.Surface.Make(wPx, hPx);
  if (!surface) {
    throw new Error(`Could not create a ${wPx}x${hPx} offscreen surface`);
  }

  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color("#000000"));
  // The drawing is written in points, so we change the scale, not the code.
  canvas.scale(scale, scale);
  drawRecipe(canvas, ctx);
  surface.flush();

  const snapshot = surface.makeImageSnapshot();
  const bytes = snapshot.encodeToBytes(ImageFormat.PNG, 100);
  if (!bytes) {
    throw new Error("PNG encoding failed");
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
