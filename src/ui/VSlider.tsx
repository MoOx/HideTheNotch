import { useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SymbolView, type SFSymbol } from "expo-symbols";
import * as Haptics from "expo-haptics";

import { Caption } from "./Caption";
import { BUTTON } from "./CornerButton";
import { Glass } from "./Glass";

/** The same width as the buttons below, so the right edge is one column. */
export const SLIDER_W = BUTTON;
export const SLIDER_H = 196;
/** The secondary control, shorter so the two columns end level. */
export const SLIDER_H_SHORT = 144;

type Props = {
  /** Current value, normalised to 0 to 1. */
  value: number;
  onChange: (value: number) => void;
  label: string;
  /** Sits at the foot of the track, the way the volume control's speaker does. */
  symbol: SFSymbol;
  height?: number;
};

/**
 * The iOS volume control, as closely as it can be had.
 *
 * Three things make that shape what it is, and all three were wrong before. It
 * is a **capsule**: the radius is exactly half the width, so there is no flat
 * run at the ends. The **glass is the track**, showing through above the fill
 * rather than being covered by it. And the **symbol lives at the foot of the
 * track**, dimmed, not above it as a caption: it says what is being adjusted
 * from inside the control, which is why the volume slider needs no label at
 * all.
 *
 * The whole body is the target, it fills from the bottom, and it shows no
 * number.
 */
export function VSlider({ value, onChange, label, symbol, height = SLIDER_H }: Props) {
  // The gesture is built once. Reading `value` inside it would put it in the
  // dependency list, and the detector would then be handed a new gesture on
  // every frame of the drag, which cancels the drag it is in the middle of.
  const live = useRef(value);
  live.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const start = useRef(0);
  const lastNotch = useRef(-1);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin(() => {
          start.current = live.current;
          lastNotch.current = Math.round(live.current * 10);
        })
        .onUpdate((e) => {
          const v = Math.min(1, Math.max(0, start.current - e.translationY / height));
          // A tick every tenth, so the travel is felt without the value being read.
          const notch = Math.round(v * 10);
          if (notch !== lastNotch.current) {
            lastNotch.current = notch;
            void Haptics.selectionAsync();
          }
          onChangeRef.current(v);
        }),
    [height],
  );

  const filled = Math.round(Math.min(1, Math.max(0, value)) * height);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Caption>{label}</Caption>
      <GestureDetector gesture={pan}>
        <Glass style={[styles.body, { height }]} radius={SLIDER_W / 2} interactive>
          <View style={[styles.fill, { height: filled }]} />
          <View style={styles.foot} pointerEvents="none">
            <SymbolView
              name={symbol}
              size={20}
              weight="semibold"
              // Dimmed, and dark: it spends most of its life on the white fill.
              tintColor="rgba(20,17,16,0.38)"
            />
          </View>
        </Glass>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8 },
  body: { width: SLIDER_W, justifyContent: "flex-end" },
  fill: { backgroundColor: "rgba(255,255,255,0.92)" },
  foot: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: "center",
  },
});
