import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { T } from "./theme";

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
};

/**
 * Verre liquide natif quand iOS 26 le fournit, flou classique partout ailleurs.
 * L'app ne doit jamais avoir l'air d'imiter le système : soit c'est le vrai
 * matériau, soit c'est franchement autre chose.
 */
export function Glass({ children, style, radius = T.radius }: Props) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
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
