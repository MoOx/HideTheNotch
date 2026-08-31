import { useState, type ReactNode } from "react";
import { useWindowDimensions, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, type SharedValue } from "react-native-reanimated";

/** How far past the edge a group settles, so no shadow peeks back in. */
const CLEAR = 24;

/** One duration for everything that stands aside, going and coming back. */
export const SWEEP = { duration: 220, easing: Easing.out(Easing.cubic) } as const;

/**
 * A group of controls that leaves by the nearest edge.
 *
 * The interface used to fade out under the peek, and a fade was the wrong verb
 * twice. It reads as the app dissolving rather than standing aside, next to a
 * home screen that *moves* in. And half of the interface is real glass: an
 * alpha below 1 on an ancestor sends a visual effect view through an offscreen
 * pass, where UIKit says many effects "look incorrect or do not appear at all".
 * The grid hit that first and hard, mounted inside a fade that started at zero.
 * The chrome only ever passed through it, which is harder to notice and reads
 * as a rendering glitch rather than as a bug.
 *
 * So it slides, exactly as far as it has to: the group measures itself and the
 * travel is its own distance to the edge it leaves by. A guessed distance is
 * either too short, and something stays visible, or too long, and the group
 * spends the animation off screen and appears to snap into place at the end.
 */
export function Sweep({
  t,
  edge,
  style,
  children,
}: {
  /** 0 in place, 1 gone. */
  t: SharedValue<number>;
  edge: "left" | "right" | "bottom";
  style?: ViewStyle | ViewStyle[];
  children: ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  // Zero until the first layout, which means one frame at rest. That is where
  // everything starts anyway.
  const [travel, setTravel] = useState(0);

  const moved = useAnimatedStyle(() => {
    const d = travel * t.value;
    return {
      transform: [edge === "bottom" ? { translateY: d } : { translateX: edge === "left" ? -d : d }],
    };
  });

  return (
    <Animated.View
      style={[style ?? null, moved]}
      onLayout={(e) => {
        const box = e.nativeEvent.layout;
        setTravel(
          CLEAR +
            (edge === "left"
              ? box.x + box.width
              : edge === "right"
                ? width - box.x
                : height - box.y),
        );
      }}
    >
      {children}
    </Animated.View>
  );
}
