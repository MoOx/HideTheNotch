import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Slider } from "@expo/ui";

import { Caption } from "./Caption";

/**
 * Choosing a colour, everywhere iOS is not.
 *
 * Android has no system colour panel to present, so it gets the honest general
 * answer: hue, saturation and brightness on three Material sliders. Not a
 * drawing of a colour wheel, which is the sort of thing that looks right in a
 * screenshot and is unusable with a thumb over it.
 *
 * iOS resolves `ColorControl.ios.tsx` instead and uses the system picker.
 */
export function ColorControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const hsb = useMemo(() => toHsb(value), [value]);

  return (
    <View style={styles.sliders}>
      {(["Hue", "Saturation", "Brightness"] as const).map((label, i) => (
        <View key={label} style={styles.slider}>
          <Caption>{label}</Caption>
          <Slider
            value={hsb[i]}
            min={0}
            max={1}
            onValueChange={(v) => {
              const next: [number, number, number] = [hsb[0], hsb[1], hsb[2]];
              next[i] = v;
              onChange(fromHsb(next));
            }}
          />
        </View>
      ))}
    </View>
  );
}

function toHsb(hex: string): [number, number, number] {
  const n = (i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  const r = n(0);
  const g = n(1);
  const b = n(2);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / d + 2) / 6;
    } else {
      h = ((r - g) / d + 4) / 6;
    }
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function fromHsb([h, s, v]: [number, number, number]): string {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

const styles = StyleSheet.create({
  sliders: { gap: 6 },
  slider: { gap: 2 },
});
