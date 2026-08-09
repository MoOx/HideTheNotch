import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { Canvas, Picture, Skia, createPicture } from "@shopify/react-native-skia";

import { drawRecipe, type DrawContext } from "../render/draw";

/**
 * L'aperçu n'est pas une maquette de téléphone dans un téléphone : c'est le fond
 * en plein écran, sous la vraie découpe de l'appareil. On juge le résultat en le
 * regardant, pas en l'imaginant.
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
