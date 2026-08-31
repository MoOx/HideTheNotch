import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { Canvas, Picture, Skia, createPicture } from "@shopify/react-native-skia";

import type { Geometry } from "../geometry/devices";
import type { Mask, Source } from "../recipe/types";
import { drawCompare, drawRecipe } from "../render/draw";
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
  compare = false,
}: {
  source: Source;
  mask: Mask;
  geometry: Geometry;
  image: SkImage | null;
  /** Show the wallpaper on one side and the effect on the other. */
  compare?: boolean;
}) {
  const { width, height } = geometry;

  // The pieces arrive apart rather than as one context object on purpose:
  // three of these are mounted side by side as pages, and a context rebuilt on
  // every render would redraw all three on every frame of a drag that only
  // touches one of them.
  const picture = useMemo(
    () =>
      createPicture(
        (canvas) => {
          const ctx = { recipe: { source, mask }, geometry, image };
          if (compare) {
            drawCompare(canvas, ctx);
          } else {
            drawRecipe(canvas, ctx);
          }
        },
        Skia.XYWHRect(0, 0, width, height),
      ),
    [source, mask, geometry, image, width, height, compare],
  );

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Picture picture={picture} />
    </Canvas>
  );
}
