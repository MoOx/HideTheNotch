import { requireOptionalNativeModule } from "expo";

/** The cutout's bounding box, in display pixels, as Android reports it. */
export type NativeCutout = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** How far down the system says the hole reaches, in pixels. */
  safeInsetTop: number;
  /** Pixels per point, the same number React Native lays out with. */
  density: number;
};

type HtnCutout = { getCutout(): Promise<NativeCutout | null> };

/**
 * Optional on purpose: there is no iOS side, and there is no module at all in
 * Expo Go. Both answer `null`, and `null` means "ask the safe area", which is
 * what this app did everywhere before this module existed.
 */
const native = requireOptionalNativeModule<HtnCutout>("HtnCutout");

export async function getNativeCutout(): Promise<NativeCutout | null> {
  if (!native) {
    return null;
  }
  // Nothing is caught here. A device that answers badly is still a device with
  // no known cutout, and the safe area behind this is always right, so it must
  // not become a crash: but swallowing it here would also make it invisible,
  // and this is the one measurement the whole app is built on. The caller falls
  // back and reports, which is both.
  return native.getCutout();
}
