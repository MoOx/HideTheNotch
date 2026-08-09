import type { GradientPresetId } from "../recipe/types";

export type Palette = {
  id: GradientPresetId;
  label: string;
  /** Top to bottom. */
  stops: string[];
  /** Soft halo laid over the gradient, to avoid a flat ramp. */
  halo: string;
};

export const PALETTES: Palette[] = [
  { id: "aurora", label: "Aurora", stops: ["#6B3FA0", "#2B4C8C", "#0D1220"], halo: "#C24C74" },
  { id: "haze", label: "Haze", stops: ["#8FC7E8", "#2C6E9B", "#0E2A44"], halo: "#D8E8F2" },
  { id: "ink", label: "Ink", stops: ["#1E2A38", "#121A24", "#05070A"], halo: "#3E5C7A" },
  { id: "ember", label: "Ember", stops: ["#F7B267", "#C2402A", "#2A0E10"], halo: "#FFD9A0" },
  { id: "moss", label: "Moss", stops: ["#7FD4A8", "#1F6B58", "#081814"], halo: "#CFF0DF" },
];

export function paletteById(id: GradientPresetId): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}
