import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Canvas, Picture, Skia, createPicture } from "@shopify/react-native-skia";

import type { Geometry } from "../geometry/devices";
import {
  FAMILY_LABEL,
  FAMILY_ORDER,
  type GradientPresetId,
  type Mask,
  type MaskFamily,
  type Recipe,
  type Source,
} from "../recipe/types";
import { drawRecipe } from "../render/draw";
import { PALETTES } from "../render/palettes";

const THUMB_W = 56;

/**
 * A wallpaper, small.
 *
 * Each thumbnail is the real drawing, scaled. `drawRecipe` works in points, so
 * scaling the canvas by `width / geometry.width` gives a faithful miniature of
 * whatever recipe it is handed, for free, from the one drawing path. Nothing
 * here is a second rendering of anything.
 */
function Thumb({
  recipe,
  geometry,
  label,
  selected,
  onPress,
}: {
  recipe: Recipe;
  geometry: Geometry;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const height = Math.round((THUMB_W * geometry.height) / geometry.width);

  const picture = useMemo(() => {
    const k = THUMB_W / geometry.width;
    return createPicture(
      (canvas) => {
        canvas.scale(k, k);
        drawRecipe(canvas, { recipe, geometry, image: null });
      },
      Skia.XYWHRect(0, 0, THUMB_W, height),
    );
  }, [recipe, geometry, height]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.thumb, { height }, selected && styles.selected]}
    >
      <Canvas style={{ width: THUMB_W, height }}>
        <Picture picture={picture} />
      </Canvas>
    </Pressable>
  );
}

/**
 * The gradients, shown rather than named. A list of words says nothing about
 * something whose entire content is how it looks.
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
  return (
    <View style={styles.row}>
      {PALETTES.map((p) => (
        <Thumb
          key={p.id}
          geometry={geometry}
          label={p.label}
          selected={current === p.id}
          onPress={() => onPick(p.id)}
          recipe={{ source: { type: "gradient", preset: p.id, seed: 1 }, mask }}
        />
      ))}
    </View>
  );
}

/**
 * The effects, on the wallpaper you are actually using.
 *
 * Each shows that family at its own current setting rather than at a canned
 * default, so the thumbnail is a promise about what tapping it gives you.
 */
export function EffectRow({
  geometry,
  source,
  masks,
  current,
  onPick,
}: {
  geometry: Geometry;
  source: Source;
  masks: Record<MaskFamily, Mask>;
  current: MaskFamily;
  onPick: (family: MaskFamily) => void;
}) {
  return (
    <View style={styles.row}>
      {FAMILY_ORDER.map((f) => (
        <Thumb
          key={f}
          geometry={geometry}
          label={FAMILY_LABEL[f]}
          selected={current === f}
          onPress={() => onPick(f)}
          // A photo source cannot be drawn without its decoded image, which we
          // do not carry here; the gradient stands in and the mask, which is
          // the point of the row, is exact.
          recipe={{
            source:
              source.type === "gradient" ? source : { type: "gradient", preset: "aurora", seed: 1 },
            mask: masks[f],
          }}
        />
      ))}
    </View>
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
