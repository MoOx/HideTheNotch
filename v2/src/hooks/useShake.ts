import { useEffect, useRef } from "react";
import { Accelerometer } from "expo-sensors";

/**
 * Secouer ouvre le menu de support. Trois secousses en moins d'une seconde, puis
 * une seconde et demie de silence — assez pour que le geste soit délibéré, assez
 * peu pour qu'il marche du premier coup.
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
