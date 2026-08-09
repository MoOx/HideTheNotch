import { useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

import { T } from "./theme";

const SNAP_TOLERANCE = 7;

type Props = {
  /** Current position, in points from the top of the screen. */
  y: number;
  label: string;
  min: number;
  max: number;
  /** Magnetic positions, in points. */
  snaps?: number[];
  onChange: (y: number) => void;
};

/**
 * A draggable handle sitting on the wallpaper itself.
 *
 * It carries two things no slider can: the physical constraint (`min` is the
 * bottom of the cutout, you cannot go above it), and the fact that you see what
 * you are adjusting, where you are adjusting it. When the handle hits the floor
 * or snaps, it vibrates: the rule is learned by touch, without a help screen.
 */
export function DragHandle({ y, label, min, max, snaps = [], onChange }: Props) {
  const startY = useRef(y);
  const lastSnap = useRef<number | null>(null);
  const wasClamped = useRef(false);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        // Everything runs on the JS thread: drawing a mask is trivial, and this
        // avoids having to keep the recipe alive inside worklets.
        .runOnJS(true)
        .onBegin(() => {
          startY.current = y;
          lastSnap.current = null;
          wasClamped.current = false;
        })
        .onUpdate((e) => {
          const raw = startY.current + e.translationY;
          const clamped = Math.min(max, Math.max(min, raw));

          if (clamped !== raw && !wasClamped.current) {
            wasClamped.current = true;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
          } else if (clamped === raw) {
            wasClamped.current = false;
          }

          const hit = snaps.find((s) => Math.abs(clamped - s) <= SNAP_TOLERANCE);
          if (hit !== undefined) {
            if (lastSnap.current !== hit) {
              lastSnap.current = hit;
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            onChange(hit);
            return;
          }

          lastSnap.current = null;
          onChange(clamped);
        }),
    [y, min, max, snaps, onChange]
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.hit, { top: y - 22 }]} pointerEvents="auto">
        <View style={styles.line} />
        <Text style={styles.label}>{label}</Text>
        <View style={styles.grip} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hit: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 44,
    justifyContent: "center",
  },
  line: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 22,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  label: {
    position: "absolute",
    left: 16,
    top: 4,
    color: T.text,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    backgroundColor: "rgba(0,0,0,0.45)",
    overflow: "hidden",
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  grip: {
    position: "absolute",
    right: 16,
    top: 15,
    width: 40,
    height: 15,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
});
