import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Slider } from "@expo/ui";

import { Caption } from "./Caption";
import { T } from "./theme";

/**
 * Choosing a colour, everywhere iOS is not.
 *
 * Android has no system colour panel to present, so it gets the honest general
 * answer: hue, saturation and brightness on three Material sliders. Not a
 * drawing of a colour wheel, which is the sort of thing that looks right in a
 * screenshot and is unusable with a thumb over it.
 *
 * They stay folded behind one row so that this reads as a menu item next to
 * Delete rather than as a control panel that happens to be in a menu, which is
 * what it is on iOS, where the same row opens the system picker.
 *
 * iOS resolves `ColorControl.ios.tsx` instead.
 */
export function ColorControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hsb = useMemo(() => toHsb(value), [value]);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose color"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.row}
      >
        <Text style={styles.rowText}>Choose color</Text>
        <View style={[styles.swatch, { backgroundColor: value }]} />
      </Pressable>

      {open ? (
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
      ) : null}
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

const SWATCH = 26;

const styles = StyleSheet.create({
  row: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowText: { color: T.text, fontSize: 15 },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.5)",
  },
  sliders: { gap: 6, paddingBottom: 10 },
  slider: { gap: 2 },
});
