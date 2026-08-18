import { Pressable, StyleSheet } from "react-native";
import { SymbolView, type SFSymbol } from "expo-symbols";

import { Glass } from "./Glass";

/**
 * The size of a system round glass button, not a size of our own.
 *
 * This was 44 for a while, on the reasoning that the system puts these at about
 * 44 across. That number is real but it is the wrong number: **44 pt is the
 * minimum tappable area** in the Human Interface Guidelines, the floor under
 * every control, and reading it as the size of a prominent round button makes
 * every prominent round button the smallest thing the guidelines allow.
 *
 * The buttons this app sits next to, the round glass controls in the Photos
 * editor and over the camera, are visibly bigger than that: a `large` button
 * configuration is 50 pt tall before any circular padding, and those land in
 * the low fifties. 54 with a 24 pt glyph, which is where this started, matches
 * them and is what the plan already asked for when it sized the slider beside
 * it at "roughly 56".
 */
export const BUTTON = 54;

/** A shade under half, which is the proportion the system's own buttons use. */
const ICON_SIZE = 24;

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
          resizeMode="scaleAspectFit"
          tintColor="#FFFFFF"
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
