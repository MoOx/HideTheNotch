import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AppState,
  Platform,
  PlatformColor,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { Canvas, Picture, Skia, createPicture, type SkImage } from "@shopify/react-native-skia";

import type { Geometry } from "../geometry/devices";
import {
  FAMILY_ORDER,
  type GradientPresetId,
  type Mask,
  type MaskFamily,
  type Recipe,
  type Source,
} from "../recipe/types";
import { familyLabel } from "../i18n";
import { drawRecipe } from "../render/draw";
import { PALETTES, presetSource } from "../render/palettes";
import { RNHostView, Row, ScrollView } from "@expo/ui";
import { listRowInsets } from "@expo/ui/swift-ui/modifiers";
/**
 * How big a thumbnail is. One number, and it does not move.
 *
 * It used to be shared out between the cells: the band took a width and every
 * thumbnail shrank until they all fitted. That makes the size of a wallpaper
 * depend on how many wallpapers there are, so a twelfth gradient would shrink
 * the other eleven, and it treats overflow as a failure when overflow is what a
 * row that scrolls is for. A thumbnail is a picture of a wallpaper: it is the
 * size that reads as one, and a sixth that does not fit is cut at the card's
 * edge, which is how anyone reads that there is more to the right.
 */
const THUMB = 56;
/** A cell is the thumbnail plus its ring and its border. */
const RING = 3;
const BORDER = 2;
/** Between a thumbnail and its caption. */
const LABEL_GAP = 3;
/** The corner of a thumbnail, and of the ring around a selected one. */
const RADIUS = 10;

/**
 * Where the inset comes from, which is the one thing the two platforms do not
 * agree on.
 *
 * iOS puts it on the row, outside the scroller, and lets it be dropped.
 * `listRowInsets` also zeroes top and bottom, since the native record fills in
 * every edge it is not given, so the content gives those back and they scroll
 * with the thumbnails rather than framing them: the band spans the card and the
 * last thumbnail is cut at its edge.
 *
 * Android keeps Material's. The inset lives inside the `ListItem`, which is the
 * card rather than the row, and it is the same sixteen the row below uses, so
 * the content adds nothing on top of it. The band is inset there rather than
 * edge to edge, which is what Material does with list content anyway.
 *
 * Reaching the card's edges there needs `Modifier.requiredWidth`, the only one
 * that ignores the constraints a parent hands down, and `@expo/ui` does not
 * expose it. It cannot be patched in either: the package ships its Android half
 * as a built `.aar` in `local-maven-repo`, which `expo-module.config.json`
 * names as the artifact, so the Kotlin beside it is never compiled by anything
 * here. The way through is upstream and a release, and until then this is the
 * layout: symmetric, and the same inset as every other row.
 */
const OWN_INSET = Platform.OS === "ios" ? { padding: 16 } : undefined;
const DROP_ROW_INSET =
  Platform.OS === "ios" ? [listRowInsets({ leading: 0, trailing: 0 })] : undefined;

/**
 * The strip the thumbnails scroll in.
 *
 * `@expo/ui`'s own `ScrollView`, so the scrolling and the sizing are the
 * platform's inside the platform's own form. A React Native scroller hosted in
 * a native row never worked: `RNHostView` fixes its size at mount, so a width
 * worked out after layout never reached it, and the band stayed at whatever it
 * had first been guessed to be.
 */
function Band({ children }: { children: ReactNode }) {
  return (
    <ScrollView direction="horizontal" showsIndicators={false} modifiers={DROP_ROW_INSET}>
      <Row style={OWN_INSET}>{children}</Row>
    </ScrollView>
  );
}

/**
 * A number that changes every time the app comes back to the front.
 *
 * Leaving the app and returning to it without killing it empties the
 * thumbnails: the row keeps its height and still scrolls, and the pictures are
 * gone. That is the Skia surface behind each canvas, which does not survive the
 * app being backgrounded while it lives inside a native host. Nothing reports
 * it, so nothing can react to it; the only move left is to build the hosts
 * again on the way back, which a changing key does.
 */
function useWake() {
  const [wake, setWake] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setWake((n) => n + 1);
      }
    });
    return () => sub.remove();
  }, []);
  return wake;
}

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
  image = null,
}: {
  recipe: Recipe;
  geometry: Geometry;
  label: string;
  selected: boolean;
  onPress: () => void;
  image?: SkImage | null;
}) {
  const width = THUMB;
  const height = Math.round((width * geometry.height) / geometry.width);

  const picture = useMemo(() => {
    const k = width / geometry.width;
    return createPicture(
      (canvas) => {
        canvas.scale(k, k);
        drawRecipe(canvas, { recipe, geometry, image });
      },
      Skia.XYWHRect(0, 0, width, height),
    );
  }, [recipe, geometry, width, height, image]);

  // Ink, not white. The ring used to be `#FFFFFF`, from when everything here
  // was on a dark sheet; on a light one it is a white ring around a picture,
  // which is a picture with nothing selected.
  const ring = useColorScheme() === "light" ? "#1C1B1F" : "#FFFFFF";

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
        style={[styles.frame, selected && { borderColor: ring }]}
      >
        <View style={[styles.clip, { width, height }]}>
          <Canvas style={{ width, height }}>
            <Picture picture={picture} />
          </Canvas>
        </View>
      </Pressable>
      <Text style={[styles.name, { maxWidth: width + 8 }]} numberOfLines={1}>
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
  const wake = useWake();
  return (
    <Band>
      {PALETTES.map((p) => (
        <RNHostView key={`${p.id}:${wake}`} matchContents>
          <Thumb
            geometry={geometry}
            label={p.label}
            selected={current === p.id}
            onPress={() => onPick(p.id)}
            recipe={{ source: presetSource(p.id), mask }}
          />
        </RNHostView>
      ))}
    </Band>
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
  image,
  masks,
  current,
  onPick,
}: {
  geometry: Geometry;
  source: Source;
  image: SkImage | null;
  masks: Record<MaskFamily, Mask>;
  current: MaskFamily;
  onPick: (family: MaskFamily) => void;
}) {
  // A photo is drawn from its decoded image, so a thumbnail can only show the
  // photo once that image is in hand. Until it is, the gradient stands in: the
  // mask, which is what the row is about, is exact either way.
  const usable = source.type === "gradient" || image !== null;
  const wake = useWake();
  return (
    <Band>
      {FAMILY_ORDER.map((f) => (
        <RNHostView key={`${f}:${wake}`} matchContents>
          <Thumb
            geometry={geometry}
            label={familyLabel(f)}
            selected={current === f}
            onPress={() => onPick(f)}
            image={image}
            recipe={{
              source: usable ? source : presetSource("aurora"),
              mask: masks[f],
            }}
          />
        </RNHostView>
      ))}
    </Band>
  );
}

const styles = StyleSheet.create({
  cell: { alignItems: "center", gap: LABEL_GAP },
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
    textAlign: "center",
    color: Platform.OS === "ios" ? PlatformColor("secondaryLabel") : "rgba(140,140,146,1)",
  },
  frame: {
    padding: RING,
    borderRadius: RADIUS + RING,
    borderWidth: BORDER,
    borderColor: "transparent",
  },
  clip: { borderRadius: RADIUS, overflow: "hidden" },
});
