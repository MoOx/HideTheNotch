import { StyleSheet } from "react-native";
import { ColorPicker, Host } from "@expo/ui/swift-ui";

import { T } from "./theme";

/**
 * Choosing a colour, on iOS.
 *
 * The system picker has a spectrum, a grid, sliders and an eyedropper that can
 * lift a colour straight off the wallpaper underneath. Nothing built here would
 * come close, so this is one `ColorPicker` and the panel it opens is the
 * system's own.
 *
 * The file is split by platform rather than branched inside one, because
 * `@expo/ui/swift-ui` asks for its native view at import time: a `Platform.OS`
 * check in the body would already be too late on Android. Android's version
 * sits in `ColorControl.tsx`.
 */
export function ColorControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    // Vertically only. `matchContents` on both axes sizes the host to what
    // SwiftUI asks for, which for a labelled picker is just wide enough for the
    // label and the swatch: the row then sat short of the menu's right edge
    // while Delete underneath reached it. Matching height alone lets React
    // Native hand SwiftUI the full width, and a `ColorPicker` given a width
    // spreads to it, label leading and swatch trailing, which is the row this
    // wanted to be all along.
    // Dark whatever the phone is set to. The chrome floats over a wallpaper and
    // is always dark, so a SwiftUI island inheriting a light appearance would
    // put dark text on dark glass.
    <Host matchContents={MATCH} colorScheme="dark" style={styles.host}>
      <ColorPicker
        selection={value}
        supportsOpacity={false}
        label="Choose color"
        onSelectionChange={(next) => onChange(normalise(next))}
      />
    </Host>
  );
}

const MATCH = { vertical: true } as const;

/**
 * The picker can hand back `#RRGGBBAA` or a shorthand. The recipe stores six
 * digits and the shader parses six digits, so this is where that is settled
 * rather than in the shader's uniforms.
 */
function normalise(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toUpperCase();
  }
  return `#${h.slice(0, 6).toUpperCase()}`;
}

const styles = StyleSheet.create({
  /** Stretched, and the same height as the row under it. */
  host: { alignSelf: "stretch", minHeight: T.row, justifyContent: "center" },
});
