import type { ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable, type GlassStyle } from "expo-glass-effect";

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
  /**
   * How much of the material there is.
   *
   * `regular` is the frosted one, which carries its own tone and reads as a
   * surface. `clear` keeps the refraction and the lit edge and drops nearly all
   * of the tone, so what is behind comes through almost unchanged. Over a
   * wallpaper the app is showing off, that is the point: chrome that bends the
   * picture rather than covering a piece of it.
   */
  effect?: GlassStyle;
  onLayout?: (e: LayoutChangeEvent) => void;
};

/**
 * What the chrome is made of where there is no liquid glass.
 *
 * `tint` on iOS is not a colour, it is a `UIBlurEffect` style, and the ones
 * named after a material are the ones iOS 18 uses for its own bars. That is
 * worth far more than a number: `intensity` is the fraction of a plain blur, so
 * turning it up thickens the haze without giving the surface any footing, and
 * tone painted over the top reads as translucent plastic. A material carries
 * its own vibrancy and its own tone, and it sits under text the way a system
 * bar does.
 *
 * Chrome, because that is what this is: buttons and sliders over a wallpaper,
 * which is what `systemChromeMaterial` exists for. The neighbours, in order of
 * how much they hide, are `systemThickMaterialDark`, `systemMaterialDark`,
 * `systemThinMaterialDark` and `systemUltraThinMaterialDark`, and swapping one
 * for another is the whole of tuning this.
 *
 * `Dark` is not a guess about the appearance. Everything using `Glass` sits
 * over the wallpaper, where the palette is always the light-on-dark one, see
 * `theme.ts`.
 */
const MATERIAL = "systemUltraThinMaterialDark" as const;

/**
 * Native liquid glass when iOS 26 provides it, a system material everywhere
 * else. The app should never look like it is imitating the system: either it is
 * the real thing, or it is plainly something else.
 *
 * `effect` only reaches the liquid glass. Clear glass is the regular one with
 * its tone taken out and its refraction kept, and a blur has no refraction to
 * keep: asking a fallback for less of itself gave a button you could not find
 * on a busy wallpaper, which is how this came up.
 */
export function Glass({
  children,
  style,
  radius = T.radius,
  interactive,
  effect = "regular",
  onLayout,
}: Props) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle={effect}
        isInteractive={interactive}
        onLayout={onLayout}
        style={[styles.base, { borderRadius: radius }, style]}
      >
        {children}
      </GlassView>
    );
  }

  // `effect` is not read here, and that is deliberate: see `MATERIAL`.
  return (
    <View
      onLayout={onLayout}
      style={[styles.base, styles.fallback, { borderRadius: radius }, style]}
    >
      <BlurView
        intensity={effect === "clear" ? 40 : 80}
        tint={MATERIAL}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
  /**
   * The material where there is no liquid glass, which is two different
   * materials.
   *
   * A lit hairline edge is how iOS says "this is glass", and Material has no
   * such thing: its surfaces are told apart by tone, not by an edge. So Android
   * gets a translucent `surfaceContainer` and no rim, which reads as a Material
   * surface floating over the wallpaper rather than as a borrowed one.
   */
  fallback: Platform.select({
    // `BlurView` needs `experimentalBlurMethod` to draw anything on Android, so
    // the surface here is the tone alone.
    android: { backgroundColor: "rgba(0,0,0,0.05)" },
    // No wash over the material: it brings its own, and a second one on top is
    // what made this look like plastic rather than glass. The hairline stays,
    // because a lit edge is how iOS says the thing is a surface.
    default: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: T.stroke,
    },
  }),
});
