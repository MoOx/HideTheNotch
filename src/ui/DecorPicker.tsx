import { Pressable, StyleSheet, View } from "react-native";
import { SymbolView, type SFSymbol } from "expo-symbols";
import * as Haptics from "expo-haptics";

import type { DecorPattern } from "../recipe/types";
import { Caption } from "./Caption";
import { Glass } from "./Glass";

const PATTERN: { id: DecorPattern; symbol: SFSymbol; label: string }[] = [
  { id: "rig", symbol: "lamp.ceiling", label: "Hanging lamp" },
  { id: "vine", symbol: "leaf", label: "Branch and leaves" },
  { id: "garland", symbol: "lightbulb", label: "Garland" },
];

/**
 * Which thing is hanging over the cutout.
 *
 * The same column as the fade's curve picker, because it does the same job: a
 * short exclusive choice, one cell each, the chosen one filled. Tapping the
 * pattern already chosen reshuffles its seed, which is where the randomness
 * lives without costing a button of its own.
 */
export function DecorPicker({
  value,
  onChange,
}: {
  value: DecorPattern;
  onChange: (v: DecorPattern) => void;
}) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Caption>Decor</Caption>
      <Glass style={styles.column} radius={CELL / 2 + 4}>
        {PATTERN.map(({ id, symbol, label }) => {
          const on = id === value;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={on ? `${label}, tap to shuffle` : label}
              style={[styles.cell, on && styles.cellOn]}
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(id);
              }}
            >
              <SymbolView
                name={symbol}
                size={22}
                resizeMode="scaleAspectFit"
                tintColor={on ? "#141110" : "#FFFFFF"}
              />
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

const CELL = 44;

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8 },
  column: { flexDirection: "column", padding: 4, gap: 2 },
  cell: {
    width: CELL,
    height: CELL,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: CELL / 2,
  },
  cellOn: { backgroundColor: "rgba(255,255,255,0.92)" },
});
