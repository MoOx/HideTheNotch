import { StyleSheet, View } from "react-native";

import { FAMILY_ORDER, type MaskFamily } from "../recipe/types";
import { T } from "./theme";

/**
 * Which effect is on screen, said the way the home screen says which page is on
 * screen: by position, not by name.
 *
 * It used to be a label inside the toolbar, which made the toolbar exist. Out
 * here it costs nothing, needs no translation, and the swipe that changes
 * family now has something to move.
 */
export function FamilyDots({ family }: { family: MaskFamily }) {
  return (
    <View
      style={styles.row}
      pointerEvents="none"
      // Which effect is showing is already announced by the wallpaper itself,
      // which is the thing you change it on. Three unlabelled dots repeating it
      // would be three stops on the way to somewhere.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {FAMILY_ORDER.map((f) => (
        <View key={f} style={[styles.dot, f === family && styles.on]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.textFaint,
  },
  on: { width: 18, backgroundColor: T.text },
});
