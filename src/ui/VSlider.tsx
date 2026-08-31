import { useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SymbolView, type SFSymbol } from "expo-symbols";
import * as Haptics from "expo-haptics";

import { ADJUST, adjustStep } from "./a11y";
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
  /**
   * A number worth reading, at the head of the track, faint, and only while a
   * finger is on it.
   *
   * Only one setting in this app is a physical length rather than a taste, and
   * it is the one anybody would want to write down: how far the black reaches.
   * It was in the caption above the control, where it made the label jump about
   * as it changed. It is inside the control now, at the opposite end from the
   * symbol, and it arrives with the swell: a number is worth reading while it
   * is being set and is furniture the rest of the time.
   */
  readout?: string;
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
 * The whole body is the target and it fills from the bottom. It shows no
 * number either, unless the value is a length someone might want to read, in
 * which case `readout` puts it at the head of the track.
 */
export function VSlider({ value, onChange, label, symbol, readout, height = SLIDER_H }: Props) {
  // The gesture is built once. Reading `value` inside it would put it in the
  // dependency list, and the detector would then be handed a new gesture on
  // every frame of the drag, which cancels the drag it is in the middle of.
  const live = useRef(value);
  live.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const start = useRef(0);
  const lastNotch = useRef(-1);

  // The volume control swells while you hold it. `isInteractive` on the glass
  // does something like that on its own, but it scales the material inside a
  // frame that does not move, so the effect arrives clipped: a bar inside a
  // bar. Scaling the whole control instead makes the frame, the fill and the
  // symbol grow together, which is what the system control actually does.
  const grow = useSharedValue(0);
  const growStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + grow.value * 0.03 }],
    transformOrigin: "center bottom",
  }));
  // The readout comes and goes with the swell, on the same value, so it is one
  // gesture and not two things that happen to start together.
  const readoutStyle = useAnimatedStyle(() => ({ opacity: grow.value }));

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin(() => {
          start.current = live.current;
          lastNotch.current = Math.round(live.current * 10);
          grow.value = withTiming(1, { duration: 140 });
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
        })
        .onFinalize(() => {
          grow.value = withTiming(0, { duration: 220 });
        }),
    [height, grow],
  );

  const filled = Math.round(Math.min(1, Math.max(0, value)) * height);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Caption>{label}</Caption>
      <GestureDetector gesture={pan}>
        {/* A drag is the only way to move this with a finger, and a screen
            reader has no drag: VoiceOver and TalkBack both take an adjustable
            control and offer it as swipe up and swipe down, which arrive here
            as increment and decrement. A tenth per step, the same tick the
            haptics give, so the two ways of setting it agree. */}
        <Animated.View
          style={growStyle}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
          accessibilityActions={ADJUST}
          onAccessibilityAction={(e) => {
            onChange(Math.min(1, Math.max(0, value + adjustStep(e.nativeEvent.actionName, 0.1))));
          }}
        >
          <Glass style={[styles.body, { height }]} radius={SLIDER_W / 2} effect="clear">
            <View style={[styles.fill, { height: filled }]} />
            {readout === undefined ? null : (
              <Animated.View style={[styles.head, readoutStyle]} pointerEvents="none">
                <Text style={styles.readout} numberOfLines={1}>
                  {readout}
                </Text>
              </Animated.View>
            )}
            <View style={styles.foot} pointerEvents="none">
              <SymbolView
                name={symbol}
                size={20}
                weight="semibold"
                resizeMode="scaleAspectFit"
                // Dimmed, and dark: it spends most of its life on the white fill.
                tintColor="rgba(20,17,16,0.38)"
              />
            </View>
          </Glass>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8 },
  // Growing from the foot, so the control does not walk up the screen when it
  // swells: the bottom edge is where the thumb is.
  body: { width: SLIDER_W, justifyContent: "flex-end" },
  fill: { backgroundColor: "rgba(255,255,255,0.92)" },
  foot: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: "center",
  },
  // The symbol's mirror image, at the other end and in the other ink. The foot
  // spends its life on the white fill, so it is dark; the head spends its life
  // on the glass, so it is light. At the very top of the travel the fill
  // reaches it and it fades out, which is the one moment the number says
  // nothing anybody did not already know.
  //
  // Fading a child of the glass, not the glass itself: an alpha below 1 on a
  // visual effect view or on any of its *ancestors* is what empties it, and
  // this is neither.
  head: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 9,
    alignItems: "center",
  },
  readout: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.2,
  },
});
