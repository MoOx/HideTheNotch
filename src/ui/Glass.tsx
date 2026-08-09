import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { T } from "./theme";

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /**
   * Buttons, as opposed to panels. Liquid glass reacts to the touch itself,
   * which is most of what makes a real one feel real.
   */
  interactive?: boolean;
};

/**
 * Native liquid glass when iOS 26 provides it, a classic blur everywhere else.
 * The app should never look like it is imitating the system: either it is the
 * real material, or it is plainly something else.
 */
export function Glass({ children, style, radius = T.radius, interactive }: Props) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive={interactive}
        style={[styles.base, { borderRadius: radius }, style]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[styles.base, styles.fallback, { borderRadius: radius }, style]}>
      <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
  fallback: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.stroke,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
});
