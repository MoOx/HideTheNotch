import type { GradientPresetId } from "../recipe/types";

export type Palette = {
  id: GradientPresetId;
  label: string;
  /** Du haut vers le bas. */
  stops: string[];
  /** Halo doux posé par-dessus, pour éviter le dégradé plat. */
  halo: string;
};

export const PALETTES: Palette[] = [
  { id: "aurore", label: "Aurore", stops: ["#6B3FA0", "#2B4C8C", "#0D1220"], halo: "#C24C74" },
  { id: "brume", label: "Brume", stops: ["#8FC7E8", "#2C6E9B", "#0E2A44"], halo: "#D8E8F2" },
  { id: "encre", label: "Encre", stops: ["#1E2A38", "#121A24", "#05070A"], halo: "#3E5C7A" },
  { id: "braise", label: "Braise", stops: ["#F7B267", "#C2402A", "#2A0E10"], halo: "#FFD9A0" },
  { id: "mousse", label: "Mousse", stops: ["#7FD4A8", "#1F6B58", "#081814"], halo: "#CFF0DF" },
];

export function paletteById(id: GradientPresetId): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}
