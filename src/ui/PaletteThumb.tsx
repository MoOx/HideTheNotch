import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Canvas, Picture, Skia, createPicture } from "@shopify/react-native-skia";

import type { Geometry } from "../geometry/devices";
import type { GradientPresetId, Mask } from "../recipe/types";
import { drawRecipe } from "../render/draw";
import { PALETTES } from "../render/palettes";

const THUMB_W = 56;

/**
 * The gradients, shown rather than named.
 *
 * A list of words is the wrong control for something whose whole content is
 * visual: iOS shows wallpapers as wallpapers when you pick one, and so should
 * this.
 *
 * Each thumbnail is the real drawing, scaled. `drawRecipe` works in points, so
 * scaling the canvas by `width / geometry.width` gives a faithful miniature
 * including the mask, for free, from the one drawing path. Nothing here is a
 * separate rendering of anything.
 */
export function PaletteRow({
  geometry,
  mask,
  current,
  onPick,
}: {
  geometry: Geometry;
  mask: Mask;
  current: GradientPresetId | "photo";
  onPick: (id: GradientPresetId) => void;
}) {
  const h = Math.round((THUMB_W * geometry.height) / geometry.width);

  return (
    <View style={styles.row}>
      {PALETTES.map((p) => (
        <Thumb
          key={p.id}
          id={p.id}
          label={p.label}
          geometry={geometry}
          mask={mask}
          height={h}
          selected={current === p.id}
          onPick={onPick}
        />
      ))}
    </View>
  );
}

function Thumb({
  id,
  label,
  geometry,
  mask,
  height,
  selected,
  onPick,
}: {
  id: GradientPresetId;
  label: string;
  geometry: Geometry;
  mask: Mask;
  height: number;
  selected: boolean;
  onPick: (id: GradientPresetId) => void;
}) {
  const picture = useMemo(() => {
    const k = THUMB_W / geometry.width;
    return createPicture((canvas) => {
      canvas.scale(k, k);
      drawRecipe(canvas, {
        recipe: { source: { type: "gradient", preset: id, seed: 1 }, mask },
        geometry,
        image: null,
      });
    }, Skia.XYWHRect(0, 0, THUMB_W, height));
  }, [id, geometry, mask, height]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => onPick(id)}
      style={[styles.thumb, { height }, selected && styles.selected]}
    >
      <Canvas style={{ width: THUMB_W, height }}>
        <Picture picture={picture} />
      </Canvas>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, paddingVertical: 6 },
  thumb: {
    width: THUMB_W,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  selected: { borderColor: "#FFFFFF" },
});
