import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMaterialColors } from "@expo/ui/jetpack-compose";
import { Host, Slider } from "@expo/ui/jetpack-compose";

import { t } from "../i18n";
import { Caption } from "./Caption";
import { T } from "./theme";

/**
 * Choosing a colour, everywhere iOS is not.
 *
 * Android has no system colour panel to present, so it gets the honest general
 * answer: hue, saturation and brightness on three Material sliders. Not a
 * drawing of a colour wheel, which is the sort of thing that looks right in a
 * screenshot and is unusable with a thumb over it. And not a colour picker
 * package either: three sliders and forty lines of colour conversion is not
 * worth a dependency, and every one of those packages draws its own wheel.
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
  // The row's own two colours, from the sheet's Material scheme rather than
  // from the app's palette: `src/ui/theme.ts` is white on a wallpaper, which is
  // the wrong ink for a menu that follows the phone.
  const colors = useMaterialColors();

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("chooseColor")}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.row}
      >
        <Text style={[styles.rowText, { color: colors.onSurface }]}>{t("chooseColor")}</Text>
        <View
          style={[styles.swatch, { backgroundColor: value, borderColor: colors.outlineVariant }]}
        />
      </Pressable>

      {open ? (
        <View style={styles.sliders}>
          {([t("hue"), t("saturation"), t("brightness")] as const).map((label, i) => (
            <View key={label} style={styles.slider}>
              <Caption>{label}</Caption>
              {/* One Host per slider, and the slider its only child. These are
                  Jetpack Compose views, not React Native ones: Compose needs a
                  composition boundary of its own, and any plain View between
                  the two breaks it. Without this the sliders did not render at
                  all, which is what three labels with nothing beside them
                  were. The height is given rather than measured, because a
                  Material slider has one and a host that has to be told its
                  size after the fact starts at zero. */}
              <Host style={styles.host}>
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
              </Host>
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
    height: T.row,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowText: { fontSize: T.rowText },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sliders: { gap: 6, paddingBottom: 10 },
  slider: { gap: 2 },
  host: { height: 44 },
});
