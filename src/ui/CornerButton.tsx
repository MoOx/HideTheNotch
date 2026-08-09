import { Pressable, StyleSheet } from "react-native";
import { SymbolView, type SFSymbol } from "expo-symbols";

import { Glass } from "./Glass";

export const BUTTON = 54;

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
  /** The save button is solid: it is the one action the screen exists for. */
  filled?: boolean;
};

/**
 * One of the two buttons left in the interface, in a bottom corner.
 *
 * Icon only, no caption: with two buttons in fixed corners there is nothing to
 * disambiguate, and a caption only makes the glass bigger. On iOS 26 the
 * material is a real `UIVisualEffectView`, so the button belongs to the system
 * instead of imitating it.
 */
export function CornerButton({ icon, label, onPress, filled }: Props) {
  const tint = filled ? "#141110" : "#FFFFFF";
  const glyph = <SymbolView name={ICON[icon]} size={23} tintColor={tint} />;

  if (filled) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.button, styles.solid]}
        onPress={onPress}
      >
        {glyph}
      </Pressable>
    );
  }

  return (
    <Glass style={styles.button} radius={BUTTON / 2}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.hit}
        onPress={onPress}
      >
        {glyph}
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
  solid: { backgroundColor: "rgba(255,255,255,0.94)" },
  hit: { width: BUTTON, height: BUTTON, alignItems: "center", justifyContent: "center" },
});
