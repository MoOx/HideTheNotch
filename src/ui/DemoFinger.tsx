import { StyleSheet, View } from "react-native";

import type { Finger } from "../demo/useDemo";

/** Roughly a fingertip, which is also the minimum tappable area. */
const SIZE = 44;

/**
 * The touch the demo is pretending to make.
 *
 * A screen that moves on its own with nothing touching it reads as a video of a
 * video, which is the wrong thing for an App Preview: Apple wants the app in
 * use. So the script draws what a hand would be doing.
 *
 * Three parts, and each one is there to undo a different tell that a machine is
 * driving: the contact patch stretches along its direction of travel, because a
 * fingertip on glass is an ellipse and not a cursor; the stroke behind it
 * tapers away, because the eye needs to see where a movement came from to read
 * it as one movement; and a tap spreads a ring, because a press with no
 * consequence looks like a missed one.
 *
 * It never takes a touch, and it is never shown outside the demo.
 */
export function DemoFinger({ finger }: { finger: Finger | null }) {
  if (!finger) {
    return null;
  }

  const { x, y, press, angle, speed, trail, ripple } = finger;

  return (
    <>
      {trail.map((p, i) => {
        // Oldest first, so the stroke thins and fades back towards where the
        // finger came from.
        const t = (i + 1) / (trail.length + 1);
        const d = SIZE * (0.3 + 0.55 * t);
        return (
          <View
            key={i}
            pointerEvents="none"
            style={[
              styles.ink,
              {
                left: p.x - d / 2,
                top: p.y - d / 2,
                width: d,
                height: d,
                borderRadius: d / 2,
                // The tail has to fade to nothing rather than end on a line,
                // but not so fast that only the last two marks are visible.
                opacity: 0.45 * t * t + 0.06 * t,
              },
            ]}
          />
        );
      })}

      {ripple > 0 && ripple < 1 && (
        <View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              left: x - SIZE,
              top: y - SIZE,
              opacity: (1 - ripple) * 0.45,
              transform: [{ scale: 0.35 + ripple * 0.75 }],
            },
          ]}
        />
      )}

      <View
        pointerEvents="none"
        style={[
          styles.pad,
          {
            left: x - SIZE / 2,
            top: y - SIZE / 2,
            backgroundColor: `rgba(255,255,255,${0.2 + press * 0.26})`,
            // The rim softens as the pad spreads. A pressed fingertip has no
            // edge left to speak of, which is most of what makes it read as
            // flesh rather than as a token being moved around.
            borderColor: `rgba(255,255,255,${0.8 - press * 0.4})`,
            transform: [
              { rotate: `${angle}rad` },
              // Two effects on the same ellipse: stretched along the travel and
              // pinched across it by the movement, spread wider and flatter by
              // the load. Both conserve roughly the same area, which is what
              // keeps it looking like one soft thing.
              { scaleX: (1 + speed * 0.5) * (1 + press * 0.3) },
              { scaleY: (1 - speed * 0.22) * (1 - press * 0.2) },
            ],
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  ink: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  ring: {
    position: "absolute",
    width: SIZE * 2,
    height: SIZE * 2,
    borderRadius: SIZE,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
  },
  pad: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    // A white mark has to survive being dragged across a white wallpaper. The
    // shadow is what keeps it readable on Haze as well as on Ink.
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
});
