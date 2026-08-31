import { useEffect, useMemo, useState } from "react";
import { PixelRatio, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Device from "expo-device";

import { getNativeCutout, type NativeCutout } from "../../modules/htn-cutout";
import {
  cutoutFromRect,
  inferCutout,
  type Cutout,
  type CutoutKind,
  type CutoutSource,
  type Geometry,
} from "./devices";
import { cutoutForModel } from "./models";
import { report } from "../report";

/**
 * Geometry of the current device.
 *
 * Everything here is measured rather than assumed, in three layers that all
 * answer the same question and are tried in that order:
 *
 * 1. **Android, the system.** `DisplayCutout` gives the hole's real rectangle,
 *    including where across the width it sits, which no inset can say.
 * 2. **iOS, the hardware identifier.** Apple publishes no shape, and there are
 *    few enough iPhones for a table (`models.ts`).
 * 3. **The safe area.** Under both, and the only one that is guaranteed: a
 *    cutout is inside the safe area by construction, so a mask measured from
 *    it covers the hole whatever the first two say. It is what a phone newer
 *    than this app falls back to.
 *
 * Which of the three answered is carried on the geometry as `cutoutFrom`,
 * because the black is allowed to stop at a hole the device measured and not
 * at one read off a table. See `maskFloor`.
 */
export function useDeviceGeometry(): Geometry {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = PixelRatio.get();
  const native = useNativeCutout();

  return useMemo(() => {
    const known = resolve(native, width, insets.top);
    return {
      label: Device.modelName ?? `${Platform.OS} ${width}x${height}`,
      kind: known.kind,
      width,
      height,
      scale,
      insetTop: insets.top,
      insetBottom: insets.bottom,
      cutout: known.cutout,
      cutoutFrom: known.cutoutFrom,
    };
  }, [native, width, height, scale, insets.top, insets.bottom]);
}

function resolve(
  native: NativeCutout | null,
  width: number,
  insetTop: number,
): { kind: CutoutKind; cutout: Cutout; cutoutFrom: CutoutSource } {
  if (native) {
    return { ...cutoutFromRect(native, native.density), cutoutFrom: "system" };
  }
  if (Platform.OS === "ios") {
    const known = cutoutForModel(Device.modelId, width);
    if (known) {
      return { ...known, cutoutFrom: "models" };
    }
  }
  return { ...inferCutout(Platform.OS, width, insetTop), cutoutFrom: "safeArea" };
}

/**
 * The native answer, once it arrives.
 *
 * It is one call and it is asked once: a phone does not grow a second camera
 * while the app is open. Rotation would move the rectangle, but this app is
 * portrait only, so there is nothing to listen to.
 *
 * Until it answers, and forever on iOS and in Expo Go, this is `null` and the
 * layers below take over. The first frame is therefore drawn from the safe
 * area, which is the right thing to draw from anyway.
 */
function useNativeCutout(): NativeCutout | null {
  const [cutout, setCutout] = useState<NativeCutout | null>(null);

  useEffect(() => {
    let alive = true;
    getNativeCutout().then(
      (c) => {
        if (alive) {
          setCutout(c);
        }
      },
      (e) => {
        // The layers below take over, which is what would have happened anyway.
        // Reporting it is the whole difference: a phone whose system refuses to
        // describe its own cutout is a phone this app is wrong about, silently,
        // and there is no other way to find out.
        report("cutout.native", e);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  return cutout;
}
