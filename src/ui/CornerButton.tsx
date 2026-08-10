import { Pressable, StyleSheet } from "react-native";
import { SymbolView, type SFSymbol } from "expo-symbols";

import { Glass } from "./Glass";

/**
 * The size of a system round glass button, not a size of our own.
 *
 * 54 was too big next to the Photos editor's own controls. The system puts
 * these at about 44 across with the glyph a little under half of that, which is
 * also the smallest comfortable touch target, so the button is exactly as big
 * as it needs to be and no bigger.
 */
export const BUTTON = 44;

const ICON_SIZE = 20;

/**
 * Optical centring for symbols that are not symmetrical.
 *
 * `square.and.arrow.up` is a box with an arrow escaping out of the top: its
 * bounding box is taller than its visual mass and the weight sits low, so
 * centring the box leaves the glyph looking high. Apple does not centre the
 * bounding box either, it aligns symbols on a baseline grid where each glyph
 * carries its own metrics; rendered into a plain square view that information
 * is gone, so it has to be put back by hand. A point and a half down is what it
 * takes for the box to look centred while the arrow overshoots, which is the
 * intended reading.
 */
const OPTICAL: Partial<Record<keyof typeof ICON, number>> = { export: 1.5 };

/**
 * The icons, named once per platform.
 *
 * `expo-symbols` draws an SF Symbol on iOS and a Material Symbol on Android
 * from the same call, with the font bundled rather than fetched. So the icon is
 * the platform's own, not a drawing of it, on both sides.
 */
export const ICON = {
  photo: { ios: "photo" as SFSymbol, android: "image" as const },
  // The button opens the export sheet rather than saving, so it carries the
  // share mark, the arrow leaving the box. The row inside the sheet that does
  // save keeps the arrow going into the tray.
  export: { ios: "square.and.arrow.up" as SFSymbol, android: "ios_share" as const },
} as const;

type Props = {
  icon: keyof typeof ICON;
  label: string;
  onPress: () => void;
};

/**
 * One of the two buttons left in the interface, in a bottom corner.
 *
 * Icon only, no caption, and both alike: with two buttons in fixed corners
 * there is nothing to disambiguate, and a caption only makes the glass bigger.
 * On iOS 26 the material is a real `UIVisualEffectView`, so the button belongs
 * to the system instead of imitating it.
 */
export function CornerButton({ icon, label, onPress }: Props) {
  return (
    <Glass style={styles.button} radius={BUTTON / 2} interactive>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.hit}
        onPress={onPress}
      >
        <SymbolView
          name={ICON[icon]}
          size={ICON_SIZE}
          tintColor="#FFFFFF"
          style={{ transform: [{ translateY: OPTICAL[icon] ?? 0 }] }}
        />
      </Pressable>
    </Glass>
  );
}

const styles = StyleSheet.create({
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  hit: { width: BUTTON, height: BUTTON, alignItems: "center", justifyContent: "center" },
});
