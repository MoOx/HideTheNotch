/**
 * The palette of everything that floats **above the wallpaper**: the corner
 * buttons, the sliders, the captions, the gradient editor. Always white and
 * translucent, in both appearances, and that is not an oversight.
 *
 * What is behind it is the user's own photo or gradient, whose top is black by
 * construction. There is no light surface to be legible against, so there is
 * no light variant to have: dark ink on somebody's wallpaper is dark ink on
 * nothing in particular.
 *
 * The **sheets** are the other half of the interface and take none of this.
 * They are system surfaces, they follow the phone, and anything drawn inside
 * one takes its colours from there (`useMaterialColors` on Android, the system
 * roles on iOS). Reaching for `T` inside a sheet is how a row ends up white on
 * white.
 */
export const T = {
  text: "#FFFFFF",
  textDim: "rgba(255,255,255,0.62)",
  textFaint: "rgba(255,255,255,0.38)",
  fill: "rgba(255,255,255,0.14)",
  fillStrong: "rgba(255,255,255,0.24)",
  stroke: "rgba(255,255,255,0.18)",
  scrim: "rgba(18,16,15,0.55)",
  sheet: "rgba(24,21,20,0.86)",
  accent: "#F0533A",
  radius: 20,
  gap: 10,
  /**
   * A row in a menu: its height, and the size of the text in it.
   *
   * 17 pt is the system body size, which is what SwiftUI's own controls use for
   * their label. The colour row in the point menu *is* one of those controls, so
   * anything sitting next to it has to be told the same number or the two lines
   * of the same menu come out at two different sizes.
   */
  row: 44,
  rowText: 17,
} as const;
