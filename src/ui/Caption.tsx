import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { T } from "./theme";

/**
 * The one line above a control saying what it drives.
 *
 * It sits directly on the wallpaper, which can be any colour at all, so it
 * carries its own shadow rather than a plate: a plate would be a second piece
 * of chrome for four letters.
 */
export function Caption({ children, icon }: { children: string; icon?: ReactNode }) {
  return (
    <View style={styles.row}>
      {icon}
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 5 },
  text: {
    color: T.text,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
