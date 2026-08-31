import { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { GlassContainer, GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import type { Geometry } from "../geometry/devices";
import { homeLayout, type HomeStyle, type Tile } from "./homeLayout";

/**
 * The sketched home screen, in the platform's own material.
 *
 * It used to be drawn in Skia, with a backdrop blur standing in for glass. That
 * was the only option while the store compositor had to draw the same grid
 * outside the app, and it was never the real thing: liquid glass refracts what
 * is behind it, a blur only softens it, and over a gradient there is nothing to
 * soften at all, so the tiles came out flat on exactly the wallpapers this app
 * makes. Nothing outside the app draws this grid any more, so it is views now
 * and the system provides the material.
 *
 * Views rather than a drawing is allowed here and nowhere near the export: this
 * layer is the room the wallpaper is judged in, never part of the wallpaper.
 *
 * **Nothing above this may be transparent.** UIKit is explicit about it: an
 * alpha below 1 on a visual effect view or on any of its ancestors makes the
 * system composite the whole thing in an offscreen pass, where many effects
 * "look incorrect or do not appear at all". `expo-glass-effect` then makes it
 * permanent: the effect is created once, in the first `layoutSubviews` after
 * mounting, and never re-applied while the view stays in the window. Mounted
 * inside a fade that starts at zero, every tile came up empty and stayed empty,
 * which is exactly what a cross fading peek did to it.
 *
 * So it arrives by moving instead: the page from the top, the dock from the
 * bottom, and everything from the bottom on Android where a drawer opens
 * upward. A transform costs no transparency, which is the only reason this is
 * an animation and not a hard cut.
 *
 * It leaves the same way. Coming in on rails and vanishing on release made the
 * release read as a glitch, so `visible` drives both and the tiles stay mounted
 * until the way out is finished. They are unmounted after that rather than kept
 * off screen: the glass is created once per mount and never re-applied, and a
 * fresh mount is what has been proven to produce it.
 */
export function HomeGrid({ geometry, visible }: { geometry: Geometry; visible: boolean }) {
  const style: HomeStyle = Platform.OS === "android" ? "android" : "ios";
  const layout = useMemo(() => homeLayout(geometry, style), [geometry, style]);
  const glass = isLiquidGlassAvailable();

  // How far each group has to travel to be off screen, from its own bounds
  // rather than from a number that happens to look right on one phone.
  const above = Math.max(0, ...[...layout.icons, ...layout.labels].map((t) => t.y + t.h));
  const below =
    geometry.height -
    Math.min(geometry.height, ...[...layout.dock, ...layout.plates].map((t) => t.y));

  // 1 is off screen, at both ends of the peek.
  const enter = useSharedValue(1);
  // Mounted a little longer than it is wanted, which is the whole trick.
  const [alive, setAlive] = useState(visible);

  useEffect(() => {
    if (visible) {
      setAlive(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!alive) {
      return;
    }
    // Out of the way faster than it came, because leaving is not the part
    // anyone is waiting to see.
    enter.value = withTiming(
      visible ? 0 : 1,
      visible
        ? { duration: 340, easing: Easing.out(Easing.cubic) }
        : { duration: 220, easing: Easing.in(Easing.cubic) },
      (done) => {
        if (done && !visible) {
          runOnJS(setAlive)(false);
        }
      },
    );
  }, [alive, visible, enter]);

  const page = useAnimatedStyle(() => ({
    transform: [{ translateY: (style === "android" ? below : -above) * enter.value }],
  }));
  const dock = useAnimatedStyle(() => ({ transform: [{ translateY: below * enter.value }] }));

  if (!alive) {
    return null;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, dock]}>
        {layout.plates.map((t, i) => (
          <Plate key={i} tile={t} glass={glass} />
        ))}
        {/* The dock's icons sit *inside* its plate, and a glass container merges
            whatever comes within its spacing: put both in one and the four
            icons dissolve into the slab, which is what an empty dock was. Their
            own container keeps them apart from it. */}
        <Panes tiles={layout.dock} glass={glass} />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, page]}>
        <Panes tiles={layout.icons} glass={glass} />
        {layout.labels.map((t, i) => (
          <View key={i} style={[box(t), styles.label]} />
        ))}
      </Animated.View>
    </View>
  );
}

/** A group of icons that may merge with each other, and with nothing else. */
function Panes({ tiles, glass }: { tiles: Tile[]; glass: boolean }) {
  const panes = tiles.map((t, i) => <Pane key={i} tile={t} glass={glass} />);
  return glass ? (
    // Close tiles merge into one another the way real icons do on iOS 26. The
    // spacing is smaller than the gap between two columns, so neighbours stay
    // neighbours: it is there for the moment a group is dragged together.
    <GlassContainer spacing={6} style={StyleSheet.absoluteFill}>
      {panes}
    </GlassContainer>
  ) : (
    <>{panes}</>
  );
}

/** One blank icon, in whatever material the phone has. */
function Pane({ tile, glass }: { tile: Tile; glass: boolean }) {
  if (glass) {
    // A tint, because a blank glass tile on glass is nothing at all: real icons
    // have artwork in them and these have to stand for it. No `overflow` either,
    // the shape of a glass tile is the effect's own corner configuration and
    // clipping the host view is a second opinion for UIKit to reconcile.
    return (
      <GlassView glassEffectStyle="regular" tintColor="rgba(255,255,255,0.12)" style={box(tile)} />
    );
  }

  // Two materials, not one. Before iOS 26 a blur with a lit edge is what an
  // icon looked like, and the edge is most of it. An Android adaptive icon is
  // an opaque disc with no edge at all, so giving it one would be a screenshot
  // of a phone nobody has.
  return (
    <View style={[box(tile), styles.pane, Platform.OS === "android" ? styles.disc : styles.frost]}>
      {Platform.OS === "android" ? null : (
        <BlurView intensity={26} tint="light" style={StyleSheet.absoluteFill} />
      )}
    </View>
  );
}

/** The dock's slab, or Android's search pill. */
function Plate({ tile, glass }: { tile: Tile; glass: boolean }) {
  if (glass && Platform.OS !== "android") {
    return <GlassView glassEffectStyle="clear" style={box(tile)} />;
  }
  return <View style={[box(tile), styles.pane, styles.plate]} />;
}

const box = (t: Tile): ViewStyle => ({
  position: "absolute",
  left: t.x,
  top: t.y,
  width: t.w,
  height: t.h,
  borderRadius: t.r,
});

const styles = StyleSheet.create({
  pane: { overflow: "hidden" },
  frost: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.34)",
  },
  disc: { backgroundColor: "rgba(255,255,255,0.18)" },
  plate: { backgroundColor: "rgba(255,255,255,0.10)" },
  /** A name nobody reads, at the weight of one. */
  label: { position: "absolute", backgroundColor: "rgba(255,255,255,0.34)" },
});
