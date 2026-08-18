import { useEffect, useRef } from "react";
import { Accelerometer } from "expo-sensors";

/**
 * Shaking opens the support menu. Three shakes within a second, then a second
 * and a half of quiet: enough for the gesture to be deliberate, little enough
 * that it works on the first try.
 */
export function useShake(onShake: () => void, enabled = true) {
  const handler = useRef(onShake);
  handler.current = onShake;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let hits: number[] = [];
    let quietUntil = 0;

    Accelerometer.setUpdateInterval(80);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const now = Date.now();
      if (now < quietUntil) {
        return;
      }
      const force = Math.sqrt(x * x + y * y + z * z);
      if (force < 1.9) {
        return;
      }
      hits = [...hits.filter((t) => now - t < 1000), now];
      if (hits.length >= 3) {
        hits = [];
        quietUntil = now + 1500;
        handler.current();
      }
    });

    return () => sub.remove();
  }, [enabled]);
}
