import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "./theme";

export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Fermer" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={styles.grabber} />
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {children}
      </View>
    </Modal>
  );
}

export function SheetRow({
  label,
  sub,
  right,
  primary,
  onPress,
}: {
  label: string;
  sub?: string;
  right?: string;
  primary?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        primary && styles.rowPrimary,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.rowLeft}>
        <Text style={[styles.rowLabel, primary && styles.rowLabelPrimary]}>{label}</Text>
        {sub ? <Text style={[styles.rowSub, primary && styles.rowSubPrimary]}>{sub}</Text> : null}
      </View>
      {right ? <Text style={styles.rowRight}>{right}</Text> : null}
    </Pressable>
  );
}

export function SheetLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: T.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: T.stroke,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginBottom: 6,
  },
  title: { color: T.text, fontSize: 17, fontWeight: "600", marginBottom: 2 },
  sectionLabel: {
    color: T.textFaint,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginTop: 10,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: T.fill,
  },
  rowPrimary: { backgroundColor: T.text },
  rowPressed: { opacity: 0.7 },
  rowLeft: { flex: 1, gap: 2 },
  rowLabel: { color: T.text, fontSize: 15 },
  rowLabelPrimary: { color: "#141110", fontWeight: "600" },
  rowSub: { color: T.textDim, fontSize: 12 },
  rowSubPrimary: { color: "rgba(20,17,16,0.6)" },
  rowRight: { color: T.textDim, fontSize: 12, fontVariant: ["tabular-nums"] },
});
