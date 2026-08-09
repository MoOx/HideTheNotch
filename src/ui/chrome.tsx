import { Pressable, StyleSheet, Text, View } from "react-native";

import { FAMILY_LABEL, FAMILY_ORDER, type Mask, type MaskFamily } from "../recipe/types";
import { MiniSlider, Row, Segmented } from "./controls";
import { Glass } from "./Glass";
import { T } from "./theme";

export function ActionBar({
  family,
  onSource,
  onExport,
}: {
  family: MaskFamily;
  onSource: () => void;
  onExport: () => void;
}) {
  return (
    <Glass style={styles.bar}>
      <Pressable accessibilityRole="button" style={styles.sideButton} onPress={onSource}>
        <Text style={styles.sideIcon}>◳</Text>
        <Text style={styles.sideLabel}>Source</Text>
      </Pressable>

      <View style={styles.center}>
        <Text style={styles.familyName}>{FAMILY_LABEL[family]}</Text>
        <View style={styles.dots}>
          {FAMILY_ORDER.map((f) => (
            <View key={f} style={[styles.dot, f === family && styles.dotOn]} />
          ))}
        </View>
      </View>

      <Pressable accessibilityRole="button" style={styles.primary} onPress={onExport}>
        <Text style={styles.primaryLabel}>Save</Text>
      </Pressable>
    </Glass>
  );
}

/**
 * Three controls per family at most, all live. Whatever does not fit in three
 * controls does not fit in the app.
 */
export function ControlStrip({
  mask,
  onChange,
}: {
  mask: Mask;
  onChange: (m: Mask) => void;
}) {
  return (
    <Glass style={styles.controls} radius={18}>
      {mask.type === "bar" && (
        <Row label="Radius">
          <MiniSlider
            value={mask.radius / 30}
            onChange={(v) => onChange({ ...mask, radius: v * 30 })}
          />
        </Row>
      )}

      {mask.type === "stripes" && (
        <>
          <Row label="Pattern">
            <Segmented
              value={mask.variant}
              onChange={(variant) => onChange({ ...mask, variant })}
              options={[
                { value: "lines", label: "Lines" },
                { value: "grid", label: "Grid" },
                { value: "dots", label: "Dots" },
              ]}
            />
          </Row>
          <Row label="Spacing">
            <MiniSlider
              value={(mask.period - 8) / 44}
              onChange={(v) => onChange({ ...mask, period: 8 + v * 44 })}
            />
          </Row>
          <Row label="Falloff">
            <MiniSlider value={mask.decay} onChange={(decay) => onChange({ ...mask, decay })} />
          </Row>
        </>
      )}

      {mask.type === "fade" && (
        <Row label="Curve">
          <Segmented
            value={String(mask.curve) as "0" | "1" | "2"}
            onChange={(v) => onChange({ ...mask, curve: Number(v) as 0 | 1 | 2 })}
            options={[
              { value: "0", label: "Linear" },
              { value: "1", label: "Eased" },
              { value: "2", label: "S curve" },
            ]}
          />
        </Row>
      )}
    </Glass>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  sideButton: { alignItems: "center", gap: 2, minWidth: 54 },
  sideIcon: { color: T.text, fontSize: 17, lineHeight: 20 },
  sideLabel: { color: T.text, fontSize: 10 },
  center: { flex: 1, alignItems: "center", gap: 5 },
  familyName: { color: T.text, fontSize: 13, fontWeight: "600" },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: T.textFaint },
  dotOn: { width: 12, borderRadius: 2, backgroundColor: T.text },
  primary: {
    backgroundColor: T.text,
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  primaryLabel: { color: "#141110", fontSize: 12, fontWeight: "700" },
  controls: { paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
});
