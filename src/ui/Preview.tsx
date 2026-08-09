import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { Canvas, Picture, Skia, createPicture } from "@shopify/react-native-skia";

import type { Geometry } from "../geometry/devices";
import { drawRecipe, type DrawContext } from "../render/draw";
import { drawHomeScreen } from "../render/homescreen";

/**
 * The preview is not a mockup of a phone inside a phone: it is the wallpaper,
 * full screen, under the device's real cutout. You judge the result by looking
 * at it, not by imagining it.
 */
export function Preview({ ctx }: { ctx: DrawContext }) {
  const { width, height } = ctx.geometry;

  const picture = useMemo(
    () => createPicture((canvas) => drawRecipe(canvas, ctx), Skia.XYWHRect(0, 0, width, height)),
    [ctx, width, height]
  );

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Picture picture={picture} />
    </Canvas>
  );
}

/**
 * The sketched home screen, on its own layer.
 *
 * Separate from the wallpaper for two reasons. It must never reach the export,
 * which is the recipe and nothing else. And it comes and goes under the finger,
 * so it needs to fade on its own: redrawing the wallpaper for each frame of
 * that fade would be absurd when the wallpaper is not changing.
 *
 * It depends only on the geometry, so it is drawn once per device.
 */
export function HomeScreenLayer({ geometry }: { geometry: Geometry }) {
  const { width, height } = geometry;

  const picture = useMemo(
    () =>
      createPicture(
        (canvas) => drawHomeScreen(canvas, geometry),
        Skia.XYWHRect(0, 0, width, height)
      ),
    [geometry, width, height]
  );

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}
