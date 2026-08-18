import { useMemo } from "react";
import { Platform, PlatformColor, Pressable, StyleSheet, Text, View } from "react-native";
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
import { PALETTES, presetSource } from "../render/palettes";

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

  // The selection ring is a frame around the thumbnail, not a border on it.
  // A border shares the corner with what it encloses, so a selected thumbnail
  // clipped at the same radius as an unselected one comes out visibly rounder
  // than its neighbours. Separating the two keeps every thumbnail identical and
  // lets the ring have its own, larger, concentric radius.
  return (
    <View style={styles.cell}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        onPress={onPress}
        style={[styles.frame, selected && styles.selected]}
      >
        <View style={[styles.clip, { height }]}>
          <Canvas style={{ width: THUMB_W, height }}>
            <Picture picture={picture} />
          </Canvas>
        </View>
      </Pressable>
      <Text style={styles.name} numberOfLines={1}>
        {label}
      </Text>
    </View>
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
  current: GradientPresetId | "photo" | null;
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
          recipe={{ source: presetSource(p.id), mask }}
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
            source: source.type === "gradient" ? source : presetSource("aurora"),
            mask: masks[f],
          }}
        />
      ))}
    </View>
  );
}

const RING = 3;
const RADIUS = 10;

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, paddingVertical: 6 },
  cell: { alignItems: "center", gap: 3 },
  /**
   * The caption under each thumbnail.
   *
   * No font family and no colour of our own: React Native's default face on
   * iOS is already San Francisco, and `secondaryLabel` is the system's own
   * grey, which follows the appearance and the accessibility settings for
   * free. Naming a font or picking a grey is how a caption stops looking
   * native.
   */
  name: {
    fontSize: 11,
    maxWidth: THUMB_W + 8,
    textAlign: "center",
    color: Platform.OS === "ios" ? PlatformColor("secondaryLabel") : "rgba(140,140,146,1)",
  },
  frame: {
    padding: RING,
    borderRadius: RADIUS + RING,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selected: { borderColor: "#FFFFFF" },
  clip: { width: THUMB_W, borderRadius: RADIUS, overflow: "hidden" },
});
