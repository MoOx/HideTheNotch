import { useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

import { T } from "./theme";

const SNAP_TOLERANCE = 7;

type Props = {
  /** Position courante, en points depuis le haut de l'écran. */
  y: number;
  label: string;
  min: number;
  max: number;
  /** Positions magnétiques, en points. */
  snaps?: number[];
  onChange: (y: number) => void;
};

/**
 * Une poignée tirable posée sur le fond lui-même.
 *
 * Elle porte deux choses que ne porte aucun curseur : la contrainte physique
 * — `min` est le bas de la découpe, on ne peut pas remonter au-dessus — et le
 * fait qu'on voit ce qu'on règle, là où on le règle. Quand la poignée bute ou
 * s'accroche, elle vibre : la règle s'apprend au doigt, sans écran d'aide.
 */
export function DragHandle({ y, label, min, max, snaps = [], onChange }: Props) {
  const startY = useRef(y);
  const lastSnap = useRef<number | null>(null);
  const wasClamped = useRef(false);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        // Tout se passe sur le fil JS : le dessin d'un masque est trivial, et
        // ça évite d'avoir à faire vivre la recette dans des worklets.
        .runOnJS(true)
        .onBegin(() => {
          startY.current = y;
          lastSnap.current = null;
          wasClamped.current = false;
        })
        .onUpdate((e) => {
          const raw = startY.current + e.translationY;
          const clamped = Math.min(max, Math.max(min, raw));

          if (clamped !== raw && !wasClamped.current) {
            wasClamped.current = true;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
          } else if (clamped === raw) {
            wasClamped.current = false;
          }

          const hit = snaps.find((s) => Math.abs(clamped - s) <= SNAP_TOLERANCE);
          if (hit !== undefined) {
            if (lastSnap.current !== hit) {
              lastSnap.current = hit;
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            onChange(hit);
            return;
          }

          lastSnap.current = null;
          onChange(clamped);
        }),
    [y, min, max, snaps, onChange]
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.hit, { top: y - 22 }]} pointerEvents="auto">
        <View style={styles.line} />
        <Text style={styles.label}>{label}</Text>
        <View style={styles.grip} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hit: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 44,
    justifyContent: "center",
  },
  line: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 22,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  label: {
    position: "absolute",
    left: 16,
    top: 4,
    color: T.text,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    backgroundColor: "rgba(0,0,0,0.45)",
    overflow: "hidden",
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  grip: {
    position: "absolute",
    right: 16,
    top: 15,
    width: 40,
    height: 15,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
});
