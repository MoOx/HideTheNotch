import { ImageFormat, Skia } from "@shopify/react-native-skia";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";

import { drawRecipe, type DrawContext } from "./draw";
import { report } from "../report";

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

  // The snapshot of a GPU surface is a texture, and encoding a texture reads
  // it back from the GPU piecemeal, on the GL context the UI thread draws
  // with. On an Android emulator that took 272 s for one 1080 x 2400 PNG, and
  // the UI thread, blocked on the same context, was killed as not responding;
  // found by the Maestro export flow. One read back into memory first (about
  // 100 ms there) and the encode is plain CPU work: 1 s, same bytes. If the
  // copy is refused, the texture still encodes, only slowly.
  const texture = surface.makeImageSnapshot();
  const snapshot = texture.makeNonTextureImage() ?? texture;
  const bytes = snapshot.encodeToBytes(ImageFormat.PNG, 100);
  if (!bytes) {
    throw new Error("PNG encoding failed");
  }

  const file = new File(Paths.cache, `HideTheNotch-${wPx}x${hPx}-${Date.now()}.png`);
  file.create({ overwrite: true });
  file.write(bytes);

  return { uri: file.uri, widthPx: wPx, heightPx: hPx, bytes: bytes.byteLength };
}

/**
 * What was being drawn when it went wrong, in five anonymous fields.
 *
 * There are no interaction breadcrumbs in this build (they come with tracing,
 * which is off), so a report arrives with no trail behind it. These are what
 * a trail would have been for: the recipe and the surface size are the whole
 * input to the failure, and none of it says anything about anybody.
 */
export function describeContext(ctx: DrawContext) {
  return {
    family: ctx.recipe.mask.type,
    source: ctx.recipe.source.type,
    surface: `${Math.round(ctx.geometry.width * ctx.geometry.scale)} x ${Math.round(
      ctx.geometry.height * ctx.geometry.scale,
    )}`,
    cutout: ctx.geometry.kind,
    photoDecoded: ctx.image !== null,
  };
}

export type SaveOutcome =
  | { ok: true; result: ExportResult }
  | { ok: false; reason: "permission" }
  /**
   * `rendered` is the PNG, when there is one.
   *
   * The two halves of saving fail for unrelated reasons, and only one of them
   * loses the picture. A drawing or an encode that failed leaves nothing; a
   * photo library that refused a finished file leaves the file, sitting in the
   * cache, complete. The person can still have it, which is why the file comes
   * back with the failure instead of being dropped with it.
   */
  | { ok: false; reason: "error"; rendered: ExportResult | null };

export async function saveToPhotos(ctx: DrawContext): Promise<SaveOutcome> {
  let rendered: ExportResult | null = null;
  try {
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) {
      return { ok: false, reason: "permission" };
    }
    rendered = renderToFile(ctx);
    // `saveToLibraryAsync` is the deprecated API and says so in a thrown error.
    // The class based one is the current way to add a file to the library.
    //
    // It is also the half that fails for reasons that are not about this app at
    // all: PhotoKit answered 3301 once, on iOS 27, which is its own service
    // saying it could not reach the resource it had just been handed. There is
    // nothing to retry and nothing to fix here, so the file is offered through
    // the share sheet instead, where saving to Photos is somebody else's code.
    await MediaLibrary.Asset.create(rendered.uri);
    return { ok: true, result: rendered };
  } catch (e) {
    // Worth reporting, and the permission refusal above is not: one is the app
    // failing to do its job, the other is somebody saying no.
    report("export.save", e, describeContext(ctx));
    return { ok: false, reason: "error", rendered };
  }
}
