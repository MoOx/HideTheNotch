import { useCallback, useMemo, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SymbolView, type SFSymbol } from "expo-symbols";
import * as Haptics from "expo-haptics";

import type { Geometry } from "../geometry/devices";
import { MESH_MAX, type MeshPoint } from "../recipe/types";
import { Caption } from "./Caption";
import { ColorControl } from "./ColorControl";
import { Glass } from "./Glass";
import { BUTTON } from "./CornerButton";

/**
 * The icons, named once per platform, the way the rest of the app names them:
 * `expo-symbols` draws an SF Symbol on iOS and a Material Symbol on Android
 * from the same call, but only if it is given both names.
 */
const ICON = {
  add: { ios: "plus" as SFSymbol, android: "add" as const },
  done: { ios: "checkmark" as SFSymbol, android: "check" as const },
  remove: { ios: "trash" as SFSymbol, android: "delete" as const },
} as const;

/** The dot you see, and the area that takes the touch. Never the same number. */
const HANDLE = 30;
const HIT = 48;
/** How far outside the screen a point may be pushed, as a fraction of it. */
const OVERSHOOT = 0.12;

/**
 * Editing the gradient by its points.
 *
 * The wallpaper is the control. There is no diagram of the gradient anywhere:
 * the handles sit on the thing they are changing, at the position they are
 * changing, and the screen behind them redraws under the finger. That is the
 * whole reason the gradient was rebuilt as points, and it is why the shader's
 * weight had to be exact at a point: a handle whose colour is not the colour it
 * carries would be a lie the size of the screen.
 *
 * Handles may be dragged a little past the edge. A point just off screen pulls
 * its colour in from beyond the frame, which is the difference between a corner
 * that is coloured and a corner where something ends, and it is the first thing
 * anyone tries.
 */
export function MeshEditor({
  points,
  selected,
  geometry,
  bottom,
  onChange,
  onSelect,
  onDone,
}: {
  points: MeshPoint[];
  selected: number | null;
  geometry: Geometry;
  /** The home indicator's room, which the app already worked out once. */
  bottom: number;
  onChange: (points: MeshPoint[]) => void;
  onSelect: (index: number | null) => void;
  onDone: () => void;
}) {
  const { width, height } = geometry;

  // The list during a drag, so a move reads from where the point actually is
  // rather than from a prop that is one render behind the finger.
  const live = useRef(points);
  live.current = points;

  const move = useCallback(
    (i: number, x: number, y: number) => {
      const clamp = (v: number) => Math.min(1 + OVERSHOOT, Math.max(-OVERSHOOT, v));
      const next = live.current.slice();
      next[i] = { ...next[i], x: clamp(x), y: clamp(y) };
      live.current = next;
      onChange(next);
    },
    [onChange],
  );

  const add = useCallback(() => {
    if (points.length >= MESH_MAX) {
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Where the eye is, not where the maths is: the middle of the screen is
    // both the least likely place to already hold a point and the place the
    // thumb is already near.
    const born = { x: 0.5, y: 0.5, color: points[points.length - 1]?.color ?? "#FFFFFF" };
    onChange([...points, born]);
    onSelect(points.length);
  }, [points, onChange, onSelect]);

  const remove = useCallback(() => {
    if (selected === null || points.length <= 2) {
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChange(points.filter((_, i) => i !== selected));
    onSelect(null);
  }, [selected, points, onChange, onSelect]);

  const recolour = useCallback(
    (hex: string) => {
      if (selected === null) {
        return;
      }
      const next = points.slice();
      next[selected] = { ...next[selected], color: hex };
      live.current = next;
      onChange(next);
    },
    [selected, points, onChange],
  );

  // Tapping the wallpaper puts the panel away. Without it a point dragged to
  // the bottom of the screen ends up underneath the panel that appeared because
  // it was selected, and there is no way to reach it again. The handles are
  // drawn after this, so they take a touch that lands on one.
  const deselect = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd(() => onSelect(null)),
    [onSelect],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <GestureDetector gesture={deselect}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>

      {points.map((p, i) => (
        <Handle
          key={i}
          point={p}
          index={i}
          width={width}
          height={height}
          selected={selected === i}
          onMove={move}
          onSelect={onSelect}
        />
      ))}

      <View style={[styles.bar, { bottom }]} pointerEvents="box-none">
        {selected !== null && points[selected] ? (
          <Glass style={styles.panel}>
            <Caption>Point colour</Caption>
            <ColorControl value={points[selected].color} onChange={recolour} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove this point"
              accessibilityState={{ disabled: points.length <= 2 }}
              onPress={remove}
              style={styles.remove}
            >
              <Glyph icon="remove" dim={points.length <= 2} />
            </Pressable>
          </Glass>
        ) : (
          <Caption>Drag a point, or tap one to change its colour</Caption>
        )}

        <View style={styles.buttons}>
          <Round
            icon="add"
            label="Add a point"
            disabled={points.length >= MESH_MAX}
            onPress={add}
          />
          <Round icon="done" label="Done" onPress={onDone} />
        </View>
      </View>
    </View>
  );
}

/**
 * One point.
 *
 * The drag runs through React rather than through a worklet, so the wallpaper
 * under it is redrawn from the same state the export will read: a handle that
 * slides smoothly over a picture that updates later would be showing a promise
 * instead of a result. It is the same trade the vertical drag on the main
 * parameter already makes.
 */
function Handle({
  point,
  index,
  width,
  height,
  selected,
  onMove,
  onSelect,
}: {
  point: MeshPoint;
  index: number;
  width: number;
  height: number;
  selected: boolean;
  onMove: (i: number, x: number, y: number) => void;
  onSelect: (i: number | null) => void;
}) {
  const from = useRef({ x: 0, y: 0 });
  const at = useRef(point);
  at.current = point;

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin(() => {
          from.current = { x: at.current.x, y: at.current.y };
          onSelect(index);
        })
        .onUpdate((e) => {
          onMove(
            index,
            from.current.x + e.translationX / width,
            from.current.y + e.translationY / height,
          );
        }),
    [index, width, height, onMove, onSelect],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={`Gradient point ${index + 1}`}
        style={[
          styles.hitArea,
          { left: point.x * width - HIT / 2, top: point.y * height - HIT / 2 },
        ]}
      >
        <View
          style={[styles.handle, { backgroundColor: point.color }, selected && styles.handleOn]}
        />
      </View>
    </GestureDetector>
  );
}

function Glyph({ icon, dim }: { icon: keyof typeof ICON; dim?: boolean }) {
  return (
    <SymbolView
      name={ICON[icon]}
      size={20}
      resizeMode="scaleAspectFit"
      tintColor={dim ? "rgba(255,255,255,0.35)" : "#FFFFFF"}
    />
  );
}

function Round({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: keyof typeof ICON;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Glass style={styles.round} radius={BUTTON / 2} interactive>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        onPress={disabled ? undefined : onPress}
        style={styles.hit}
      >
        <Glyph icon={icon} dim={disabled} />
      </Pressable>
    </Glass>
  );
}

const styles = StyleSheet.create({
  /**
   * The dot is 30 across and the thing that catches the finger is 48. A handle
   * sized to its own drawing is a handle that has to be aimed at.
   */
  hitArea: {
    position: "absolute",
    width: HIT,
    height: HIT,
    alignItems: "center",
    justifyContent: "center",
  },
  /**
   * A ring, not a dot with a border.
   *
   * The handle has to read against whatever colour it is sitting on, including
   * its own, so the white ring is what finds it and the fill is what says which
   * colour it carries. A dark ring would vanish on the dark presets.
   */
  handle: {
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.92)",
    shadowColor: "#000000",
    shadowOpacity: 0.45,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  handleOn: {
    borderWidth: 4,
    transform: [{ scale: 1.18 }],
  },
  bar: {
    position: "absolute",
    left: 16,
    right: 16,
    gap: 12,
    alignItems: "center",
  },
  panel: { alignSelf: "stretch", padding: 14, gap: 8 },
  remove: { alignSelf: "flex-end", padding: 4 },
  buttons: { flexDirection: "row", gap: 12 },
  round: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  hit: { width: BUTTON, height: BUTTON, alignItems: "center", justifyContent: "center" },
});
