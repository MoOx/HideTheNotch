import { useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

import { BUTTON } from "./CornerButton";
import { Glass } from "./Glass";
import { T } from "./theme";

// The same width as the button below it: two shapes on the same edge that are
// nearly but not quite aligned read as a mistake.
export const SLIDER_W = BUTTON;
export const SLIDER_H = 196;

type Props = {
  /** Current value, normalised to 0 to 1. */
  value: number;
  onChange: (value: number) => void;
  /** One word. What the control does, not what it is worth. */
  label: string;
};

/**
 * The one control that matters, in the one place a thumb reaches.
 *
 * Shaped like the iOS volume control rather than a line with a knob: the whole
 * body is the target, it fills from the bottom, and it shows no number. A
 * handle dragged near the top of the screen, which is what this replaces, sits
 * exactly over the part of the wallpaper being judged and needs a precision the
 * setting never deserved.
 */
export function MainSlider({ value, onChange, label }: Props) {
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
          const v = Math.min(1, Math.max(0, start.current - e.translationY / SLIDER_H));
          // A tick every tenth, so the travel is felt without the value being read.
          const notch = Math.round(v * 10);
          if (notch !== lastNotch.current) {
            lastNotch.current = notch;
            void Haptics.selectionAsync();
          }
          onChangeRef.current(v);
        }),
    []
  );

  const filled = Math.round(Math.min(1, Math.max(0, value)) * SLIDER_H);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Text style={styles.label}>{label}</Text>
      <GestureDetector gesture={pan}>
        <Glass style={styles.body} radius={SLIDER_W / 2 - 4}>
          <View style={[styles.fill, { height: filled }]} />
        </Glass>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8 },
  label: {
    color: T.text,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    // The label sits directly on the wallpaper, which can be any colour at all.
    // A shadow costs nothing and removes the one case where it disappears.
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  body: {
    width: SLIDER_W,
    height: SLIDER_H,
    justifyContent: "flex-end",
  },
  fill: {
    backgroundColor: "rgba(255,255,255,0.92)",
  },
});
