import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";

import { Caption } from "./Caption";
import { Glass } from "./Glass";
import { T } from "./theme";

export type CurveId = 0 | 1 | 2;

/**
 * The three curves, drawn.
 *
 * "Linear", "eased" and "S curve" are the names of the maths, not of what the
 * user sees. A small sketch of the ramp says the same thing without needing to
 * be read, and survives translation. Drawn on a 26 unit box, to match the
 * glyph size below.
 */
const SHAPE: Record<CurveId, string> = {
  0: "M3 23 L23 3",
  1: "M3 23 C 13 23, 21 15, 23 3",
  2: "M3 23 C 11 23, 15 3, 23 3",
};

const LABEL: Record<CurveId, string> = {
  0: "Straight fade",
  1: "Soft at the top",
  2: "Soft at both ends",
};

/**
 * Three buttons behaving as a radio group, stacked.
 *
 * Vertical rather than horizontal: it sits against the left edge under the
 * thumb, mirroring the slider on the right, and a column leaves the middle of
 * the screen clear. Both platforms answer a short exclusive choice with the
 * same shape, a set of equal cells where the chosen one is filled, and in glass
 * over the wallpaper that reads as the system control it echoes without
 * pretending to be a component it is not.
 */
export function CurvePicker({
  value,
  onChange,
}: {
  value: CurveId;
  onChange: (v: CurveId) => void;
}) {
  const paths = useMemo(
    () => ([0, 1, 2] as CurveId[]).map((id) => Skia.Path.MakeFromSVGString(SHAPE[id])),
    [],
  );

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Caption>Style</Caption>
      <Glass style={styles.column} radius={CELL / 2 + 4}>
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
                    strokeWidth={2}
                    strokeCap="round"
                    color={on ? "#141110" : T.text}
                  />
                </Canvas>
              )}
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

/** Cells sized like the corner buttons, so the whole chrome is on one scale. */
const CELL = 44;
const GLYPH = 26;

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
  glyph: { width: GLYPH, height: GLYPH },
});
