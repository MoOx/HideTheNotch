import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SymbolView, type SFSymbol } from "expo-symbols";
import * as Haptics from "expo-haptics";

import type { Geometry } from "../geometry/devices";
import { MESH_MAX, type MeshPoint } from "../recipe/types";
import { Caption } from "./Caption";
import { ColorControl } from "./ColorControl";
import { Glass } from "./Glass";
import { BUTTON } from "./CornerButton";
import { T } from "./theme";

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
const MENU_W = 240;

type Box = { x: number; y: number; width: number; height: number };

function inside(box: Box | null, x: number, y: number) {
  return (
    box !== null && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height
  );
}

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
 * Two things follow from this being a full screen editor on a phone that keeps
 * system gestures along its edges.
 *
 * **A point is moved by dragging anywhere, not by dragging the point.** Tap one
 * to pick it up, then drag any part of the wallpaper and it follows, one to
 * one. Dragging the handle itself still works and is what most people will
 * reach for, but it cannot be the only way: a point parked under the home
 * indicator or up by the status bar belongs to iOS while a finger is there, and
 * the first swipe goes to the system rather than to us. With the whole screen
 * acting as a trackpad for whichever point is held, where that point happens to
 * sit stops being something anyone has to think about.
 *
 * **A long press on a point opens its own menu.** Colour and delete live there
 * rather than in a panel pinned along the bottom, so nothing permanent sits
 * over the wallpaper while it is being judged, and no panel can end up covering
 * the point that opened it.
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
  const [menuFor, setMenuFor] = useState<number | null>(null);

  // The list during a drag, so a move reads from where the point actually is
  // rather than from a prop that is one render behind the finger.
  const live = useRef(points);
  live.current = points;
  const held = useRef(selected);
  held.current = selected;

  const move = useCallback(
    (i: number, x: number, y: number) => {
      const clamp = (v: number) => Math.min(1 + OVERSHOOT, Math.max(-OVERSHOOT, v));
      const next = live.current.slice();
      if (!next[i]) {
        return;
      }
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
    if (menuFor === null || points.length <= 2) {
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChange(points.filter((_, i) => i !== menuFor));
    setMenuFor(null);
    onSelect(null);
  }, [menuFor, points, onChange, onSelect]);

  const recolour = useCallback(
    (hex: string) => {
      if (menuFor === null) {
        return;
      }
      const next = points.slice();
      next[menuFor] = { ...next[menuFor], color: hex };
      live.current = next;
      onChange(next);
    },
    [menuFor, points, onChange],
  );

  const openMenu = useCallback(
    (i: number) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSelect(i);
      setMenuFor(i);
    },
    [onSelect],
  );

  // What the background gesture may not have.
  //
  // The handles, the menu and the bottom bar are drawn over a full screen
  // gesture area, and a gesture recogniser attached to a view underneath still
  // sees touches that land on the views above it: React Native's own press
  // handling and this library's recognisers are two separate systems and
  // neither cancels the other. Left alone, tapping Delete would also tap the
  // wallpaper, and dragging a handle would run two pans over the same point.
  //
  // So the background asks, in its own coordinates, whether the touch started
  // on something else. The handles it knows exactly, since it has their
  // positions; the two panels report their boxes as they lay out.
  const menuBox = useRef<Box | null>(null);
  const barBox = useRef<Box | null>(null);
  const onChrome = useCallback(
    (x: number, y: number) => {
      if (inside(menuBox.current, x, y) || inside(barBox.current, x, y)) {
        return true;
      }
      return live.current.some(
        (p) => Math.abs(p.x * width - x) <= HIT / 2 && Math.abs(p.y * height - y) <= HIT / 2,
      );
    },
    [width, height],
  );

  // The wallpaper, as a trackpad for the held point and as the way out of a
  // selection. A tap that does not travel puts the menu away and lets the point
  // go; a drag moves it one to one from wherever the finger started.
  const from = useRef({ x: 0, y: 0 });
  const skip = useRef(false);
  const background = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .minDistance(6)
      .onBegin((e) => {
        skip.current = onChrome(e.x, e.y);
        const i = held.current;
        const p = i === null ? null : live.current[i];
        from.current = p ? { x: p.x, y: p.y } : { x: 0, y: 0 };
      })
      .onUpdate((e) => {
        const i = held.current;
        if (skip.current || i === null) {
          return;
        }
        move(i, from.current.x + e.translationX / width, from.current.y + e.translationY / height);
      });

    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e) => {
        if (onChrome(e.x, e.y)) {
          return;
        }
        setMenuFor(null);
        onSelect(null);
      });

    return Gesture.Race(pan, tap);
  }, [move, width, height, onSelect, onChrome]);

  const menuPoint = menuFor === null ? null : points[menuFor];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <GestureDetector gesture={background}>
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
          onLongPress={openMenu}
        />
      ))}

      {menuPoint ? (
        <Menu
          point={menuPoint}
          width={width}
          height={height}
          canRemove={points.length > 2}
          onLayout={(box) => (menuBox.current = box)}
          onColor={recolour}
          onRemove={remove}
        />
      ) : null}

      <View
        style={[styles.bar, { bottom }]}
        pointerEvents="box-none"
        onLayout={(e) => (barBox.current = e.nativeEvent.layout)}
      >
        <Caption>
          {selected === null
            ? "Tap a point to pick it up"
            : "Drag anywhere to move it, long press it for options"}
        </Caption>
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
 *
 * Pan and long press race. The pan needs six points of travel before it can
 * take over, so a finger that stays put reaches the long press and a finger
 * that sets off is dragging before it can. Picking the point up happens in the
 * pan's `onBegin`, which runs on touch down, so a plain tap does it without
 * either gesture having to win.
 */
function Handle({
  point,
  index,
  width,
  height,
  selected,
  onMove,
  onSelect,
  onLongPress,
}: {
  point: MeshPoint;
  index: number;
  width: number;
  height: number;
  selected: boolean;
  onMove: (i: number, x: number, y: number) => void;
  onSelect: (i: number | null) => void;
  onLongPress: (i: number) => void;
}) {
  const from = useRef({ x: 0, y: 0 });
  const at = useRef(point);
  at.current = point;

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .minDistance(6)
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
      });

    const hold = Gesture.LongPress()
      .runOnJS(true)
      .minDuration(380)
      .onStart(() => onLongPress(index));

    return Gesture.Race(pan, hold);
  }, [index, width, height, onMove, onSelect, onLongPress]);

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

/**
 * The point's own menu, beside the point.
 *
 * It opens below the handle in the top half of the screen and above it in the
 * bottom half, so it never covers the thing it belongs to. In the second case
 * it is anchored by its bottom edge, which means it does not have to know its
 * own height: it is taller on Android, where choosing a colour is three sliders
 * rather than a system panel.
 */
function Menu({
  point,
  width,
  height,
  canRemove,
  onLayout,
  onColor,
  onRemove,
}: {
  point: MeshPoint;
  width: number;
  height: number;
  canRemove: boolean;
  onLayout: (box: Box) => void;
  onColor: (hex: string) => void;
  onRemove: () => void;
}) {
  const px = point.x * width;
  const py = point.y * height;
  const left = Math.min(Math.max(px - MENU_W / 2, 12), width - MENU_W - 12);
  const place = py > height / 2 ? { bottom: height - py + HIT / 2 } : { top: py + HIT / 2 };

  return (
    <Glass
      style={[styles.menu, { left, ...place }]}
      onLayout={(e) => onLayout(e.nativeEvent.layout)}
    >
      <ColorControl value={point.color} onChange={onColor} />
      <View style={styles.rule} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete this point"
        accessibilityState={{ disabled: !canRemove }}
        onPress={canRemove ? onRemove : undefined}
        style={styles.row}
      >
        <Text style={[styles.rowText, !canRemove && styles.rowTextOff]}>Delete</Text>
        <Glyph icon="remove" dim={!canRemove} />
      </Pressable>
    </Glass>
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
  menu: {
    position: "absolute",
    width: MENU_W,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: T.stroke },
  row: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowText: { color: T.text, fontSize: 15 },
  rowTextOff: { color: T.textFaint },
  bar: {
    position: "absolute",
    left: 16,
    right: 16,
    gap: 12,
    alignItems: "center",
  },
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
