import { useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";

import { Glass } from "./Glass";
import { T } from "./theme";

export type CurveId = 0 | 1 | 2;

/**
 * The three curves, drawn.
 *
 * "Linear", "eased" and "S curve" are the names of the maths, not of what the
 * user sees. A 20 point sketch of the ramp says the same thing without needing
 * to be read, and survives translation.
 */
const SHAPE: Record<CurveId, string> = {
  0: "M2 18 L18 2",
  1: "M2 18 C 10 18, 16 12, 18 2",
  2: "M2 18 C 8 18, 12 2, 18 2",
};

const LABEL: Record<CurveId, string> = {
  0: "Straight fade",
  1: "Soft at the top",
  2: "Soft at both ends",
};

/**
 * Three buttons behaving as a radio group.
 *
 * Both platforms answer a short exclusive choice with the same shape: a row of
 * equal cells where the chosen one is filled. Sitting in glass over the
 * wallpaper, that reads as the system control it echoes without pretending to
 * be a component it is not.
 */
export function CurvePicker({
  value,
  onChange,
}: {
  value: CurveId;
  onChange: (v: CurveId) => void;
}) {
  const paths = useMemo(
    () =>
      ([0, 1, 2] as CurveId[]).map((id) => Skia.Path.MakeFromSVGString(SHAPE[id])),
    []
  );

  return (
    <Glass style={styles.row} radius={22}>
      {([0, 1, 2] as CurveId[]).map((id) => {
        const on = id === value;
        const path = paths[id];
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={LABEL[id]}
            style={[styles.cell, on && styles.cellOn]}
            onPress={() => {
              if (id !== value) {
                void Haptics.selectionAsync();
                onChange(id);
              }
            }}
          >
            {path && (
              <Canvas style={styles.glyph}>
                <Path
                  path={path}
                  style="stroke"
                  strokeWidth={2.2}
                  strokeCap="round"
                  color={on ? "#141110" : T.textDim}
                />
              </Canvas>
            )}
          </Pressable>
        );
      })}
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", padding: 4, gap: 2 },
  cell: {
    width: 40,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  cellOn: { backgroundColor: "rgba(255,255,255,0.92)" },
  glyph: { width: 20, height: 20 },
});
