import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { Canvas, Picture, Skia, createPicture } from "@shopify/react-native-skia";

import { drawRecipe, type DrawContext } from "../render/draw";
import { drawHomeScreen } from "../render/homescreen";

/**
 * The preview is not a mockup of a phone inside a phone: it is the wallpaper,
 * full screen, under the device's real cutout. You judge the result by looking
 * at it, not by imagining it.
 *
 * `homeScreen` adds blank icons over the top. They are drawn here, after
 * `drawRecipe`, and never inside it: the export is the recipe and nothing else.
 */
export function Preview({ ctx, homeScreen }: { ctx: DrawContext; homeScreen: boolean }) {
  const { width, height } = ctx.geometry;

  const picture = useMemo(
    () =>
      createPicture((canvas) => {
        drawRecipe(canvas, ctx);
        if (homeScreen) {
          drawHomeScreen(canvas, ctx.geometry);
        }
      }, Skia.XYWHRect(0, 0, width, height)),
    [ctx, homeScreen, width, height]
  );

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Picture picture={picture} />
    </Canvas>
  );
}
