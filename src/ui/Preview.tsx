import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { Canvas, Picture, Skia, createPicture } from "@shopify/react-native-skia";

import type { Geometry } from "../geometry/devices";
import type { Mask, Source } from "../recipe/types";
import { drawRecipe } from "../render/draw";
import { drawHomeScreen } from "../render/homescreen";
import type { SkImage } from "@shopify/react-native-skia";

/**
 * The preview is not a mockup of a phone inside a phone: it is the wallpaper,
 * full screen, under the device's real cutout. You judge the result by looking
 * at it, not by imagining it.
 */
export function Preview({
  source,
  mask,
  geometry,
  image,
}: {
  source: Source;
  mask: Mask;
  geometry: Geometry;
  image: SkImage | null;
}) {
  const { width, height } = geometry;

  // The pieces arrive apart rather than as one context object on purpose:
  // three of these are mounted side by side as pages, and a context rebuilt on
  // every render would redraw all three on every frame of a drag that only
  // touches one of them.
  const picture = useMemo(
    () =>
      createPicture(
        (canvas) => drawRecipe(canvas, { recipe: { source, mask }, geometry, image }),
        Skia.XYWHRect(0, 0, width, height),
      ),
    [source, mask, geometry, image, width, height],
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
        Skia.XYWHRect(0, 0, width, height),
      ),
    [geometry, width, height],
  );

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}
