import type { GradientPresetId, MeshPoint } from "../recipe/types";

export type Palette = {
  id: GradientPresetId;
  label: string;
  points: MeshPoint[];
};

/**
 * A preset, as points.
 *
 * The five presets used to be three stops down a linear gradient with a radial
 * halo laid over them. They are now the same three colours placed as points,
 * which loses nothing (a pair of points across the top is a horizontal band of
 * that colour) and gains the thing that matters: the result is editable. There
 * is no second kind of gradient to maintain, and no import step between a
 * preset and something the user has moved.
 *
 * The pairs are deliberately not level with each other. Two points at the same
 * height give a band with a straight edge, and a straight edge across a
 * wallpaper is the one thing that makes a gradient look generated.
 *
 * Nothing sits in the top tenth, and nothing below nine tenths: the editor
 * refuses both bands, and a preset that started outside the rules the editor
 * enforces would be a preset that jumps the first time it is touched.
 *
 * Nothing sits in the top tenth. The editor will not let a point go up there,
 * since that band is what the mask paints black and what iOS keeps its own
 * touches in, and a preset whose points jumped the moment the editor opened
 * would be an editor that edits before it is used. There is no loss: above the
 * highest point the gradient simply is that point's colour, which is what the
 * top of the screen was showing anyway.
 *
 * The eighth point is the one that is not obvious: an anchor in the middle,
 * below the halo. Without it the two mid points sit out at the edges, nothing
 * holds the centre, and the halo runs the whole height of the screen as a
 * column of light. It carries the *mid* colour rather than the dark one: dark
 * in the middle reaches higher than the dark at the corners and the bottom
 * turns into a plume. Mid there just stops the column.
 */
function ramp(
  top: string,
  mid: string,
  low: string,
  halo: string,
  haloAt: [number, number],
  midAt: [number, number],
  /**
   * The middle anchor's colour, `mid` unless a preset needs otherwise.
   *
   * A preset that runs light at the bottom wants its anchor light too: `mid`
   * there would be a dark bruise in the middle of the horizon, which is the
   * plume this point exists to prevent, upside down.
   */
  anchor = mid,
): MeshPoint[] {
  return [
    { x: 0.08, y: 0.1, color: top },
    { x: 0.92, y: 0.16, color: top },
    { x: haloAt[0], y: haloAt[1], color: halo },
    { x: 0.1, y: midAt[0], color: mid },
    { x: 0.9, y: midAt[1], color: mid },
    { x: 0.5, y: 0.76, color: anchor },
    { x: 0.16, y: 0.92, color: low },
    { x: 0.86, y: 0.9, color: low },
  ];
}

export const PALETTES: Palette[] = [
  {
    id: "aurora",
    label: "Aurora",
    points: ramp("#6B3FA0", "#2B4C8C", "#0D1220", "#C24C74", [0.82, 0.16], [0.46, 0.58]),
  },
  {
    id: "haze",
    label: "Haze",
    points: ramp("#8FC7E8", "#2C6E9B", "#0E2A44", "#D8E8F2", [0.76, 0.2], [0.5, 0.6]),
  },
  {
    id: "ink",
    label: "Ink",
    points: ramp("#1E2A38", "#121A24", "#05070A", "#3E5C7A", [0.2, 0.24], [0.44, 0.62]),
  },
  {
    id: "ember",
    label: "Ember",
    points: ramp("#F7B267", "#C2402A", "#2A0E10", "#FFD9A0", [0.84, 0.1], [0.42, 0.54]),
  },
  {
    id: "moss",
    label: "Moss",
    points: ramp("#7FD4A8", "#1F6B58", "#081814", "#CFF0DF", [0.22, 0.18], [0.48, 0.58]),
  },
  /**
   * The one that runs the other way: light at the bottom, not at the top.
   *
   * Every other preset is bright above and dark below, which is what a sky
   * does and what makes the mask's black at the top read as part of the
   * picture. This one puts a magenta horizon low and violet above it, so the
   * gradient is a sunset seen from a car in 1984. It works with the mask for
   * the same reason: the top is the darkest part of it.
   */
  {
    id: "neon",
    label: "Neon",
    points: ramp("#2B1055", "#7A2A8C", "#FF6B3D", "#FF3D9A", [0.5, 0.62], [0.38, 0.44], "#E0457F"),
  },
];

export function paletteById(id: GradientPresetId): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/** The source for a preset, ready to put in a recipe. */
export function presetSource(id: GradientPresetId) {
  return { type: "gradient" as const, preset: id, points: paletteById(id).points };
}
