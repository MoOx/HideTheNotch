import { useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { T } from "./theme";

/**
 * A slider that never shows a value. What matters is the result on screen, not
 * the number, and a number invites hunting for "the right setting" instead of
 * looking.
 */
export function MiniSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [width, setWidth] = useState(1);
  const startX = useRef(0);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin(() => {
          startX.current = value * width;
        })
        .onUpdate((e) => {
          const x = startX.current + e.translationX;
          onChange(Math.min(1, Math.max(0, x / Math.max(width, 1))));
        }),
    [value, width, onChange]
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.sliderHit} onLayout={onLayout}>
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${value * 100}%` }]} />
        </View>
        <View style={[styles.sliderKnob, { left: `${value * 100}%` }]} />
      </View>
    </GestureDetector>
  );
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <View style={styles.segs}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.seg, on && styles.segOn]}
            onPress={() => onChange(o.value)}
          >
            <Text style={[styles.segText, on && styles.segTextOn]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  sliderHit: { height: 30, justifyContent: "center" },
  sliderTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.26)",
    overflow: "hidden",
  },
  sliderFill: { height: 3, backgroundColor: T.text },
  sliderKnob: {
    position: "absolute",
    width: 18,
    height: 18,
    marginLeft: -9,
    borderRadius: 9,
    backgroundColor: T.text,
  },
  segs: { flexDirection: "row", gap: 5 },
  seg: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: T.fill,
    alignItems: "center",
  },
  segOn: { backgroundColor: T.text },
  segText: { color: T.text, fontSize: 12 },
  segTextOn: { color: "#141110", fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 34 },
  rowLabel: {
    width: 66,
    color: T.textDim,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  rowBody: { flex: 1 },
});
