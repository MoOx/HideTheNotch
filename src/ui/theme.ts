/**
 * The interface floats above the wallpaper being edited. It is therefore always
 * dark and translucent: it must never compete with what it lets you see.
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
} as const;
