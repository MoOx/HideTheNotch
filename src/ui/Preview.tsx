import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { Canvas, Picture, Skia, createPicture } from "@shopify/react-native-skia";

import { drawRecipe, type DrawContext } from "../render/draw";

/**
 * The preview is not a mockup of a phone inside a phone: it is the wallpaper,
 * full screen, under the device's real cutout. You judge the result by looking
 * at it, not by imagining it.
 */
export function Preview({ ctx }: { ctx: DrawContext }) {
  const { width, height } = ctx.geometry;

  const picture = useMemo(
    () =>
      createPicture(
        (canvas) => drawRecipe(canvas, ctx),
        Skia.XYWHRect(0, 0, width, height)
      ),
    [ctx, width, height]
  );

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Picture picture={picture} />
    </Canvas>
  );
}
