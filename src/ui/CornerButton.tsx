import { Pressable, StyleSheet } from "react-native";
import { SymbolView, type SFSymbol } from "expo-symbols";

import { Glass } from "./Glass";

export const BUTTON = 54;

/**
 * Two thirds of the button, and semibold.
 *
 * The first pass used 23 pt, which was not chosen so much as assumed. The
 * system's own round glass buttons put the glyph at close to two thirds of the
 * circle, and they use the semibold weight: at this size a regular weight
 * symbol on translucent glass loses its thin strokes against a bright
 * wallpaper.
 */
const ICON_SIZE = Math.round(BUTTON * 0.66);

/**
 * The icons, named once per platform.
 *
 * `expo-symbols` draws an SF Symbol on iOS and a Material Symbol on Android
 * from the same call, with the font bundled rather than fetched. So the icon is
 * the platform's own, not a drawing of it, on both sides.
 */
export const ICON = {
  photo: { ios: "photo" as SFSymbol, android: "image" as const },
  save: { ios: "square.and.arrow.down" as SFSymbol, android: "download" as const },
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
        <SymbolView name={ICON[icon]} size={ICON_SIZE} weight="semibold" tintColor="#FFFFFF" />
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
