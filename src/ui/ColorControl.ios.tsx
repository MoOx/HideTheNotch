import { StyleSheet } from "react-native";
import { ColorPicker, Host } from "@expo/ui/swift-ui";

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
    <Host matchContents style={styles.host}>
      <ColorPicker
        selection={value}
        supportsOpacity={false}
        label="Colour"
        onSelectionChange={(next) => onChange(normalise(next))}
      />
    </Host>
  );
}

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
  host: { minHeight: 40 },
});
