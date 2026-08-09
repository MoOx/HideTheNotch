import { useMemo } from "react";
import { PixelRatio, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Device from "expo-device";

import { inferCutout, type Geometry } from "./devices";

/**
 * Géométrie de l'appareil courant. Tout vient du système sauf la boîte de la
 * découpe, qui est déduite (cf. `inferCutout`).
 */
export function useDeviceGeometry(): Geometry {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = PixelRatio.get();

  return useMemo(() => {
    const { kind, cutout, estimated } = inferCutout(Platform.OS, width, insets.top);
    return {
      label: Device.modelName ?? `${Platform.OS} ${width}×${height}`,
      kind,
      width,
      height,
      scale,
      insetTop: insets.top,
      insetBottom: insets.bottom,
      cutout,
      estimated,
    };
  }, [width, height, scale, insets.top, insets.bottom]);
}
