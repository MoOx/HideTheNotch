import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Application from "expo-application";
import { Platform } from "react-native";

import { DEVICE_PRESETS, type Geometry } from "../geometry/devices";
import { PALETTES } from "../render/palettes";
import type { GradientPresetId } from "../recipe/types";
import { Sheet, SheetLabel, SheetRow } from "./Sheet";
import { T } from "./theme";

const SUPPORT_EMAIL = "apps+hide-the-notch@moox.io";
const WEBSITE = "https://moox.io/apps/hide-the-notch";

// -- Source ------------------------------------------------------------------

export function SourceSheet({
  visible,
  onClose,
  onPickPhoto,
  onPickPalette,
  current,
}: {
  visible: boolean;
  onClose: () => void;
  onPickPhoto: () => void;
  onPickPalette: (id: GradientPresetId) => void;
  current: GradientPresetId | "photo";
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Source">
      <SheetRow
        label="Choose a photo"
        sub="Pinch to reframe once imported"
        primary
        onPress={onPickPhoto}
      />
      <SheetLabel>Gradients</SheetLabel>
      {PALETTES.map((p) => (
        <SheetRow
          key={p.id}
          label={p.label}
          right={current === p.id ? "✓" : undefined}
          onPress={() => onPickPalette(p.id)}
        />
      ))}
    </Sheet>
  );
}

// -- Export ------------------------------------------------------------------

export function ExportSheet({
  visible,
  onClose,
  onSave,
  onShare,
  target,
  targetId,
  onPickTarget,
  detectedLabel,
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  onShare: () => void;
  target: Geometry;
  targetId: string;
  onPickTarget: (id: string) => void;
  detectedLabel: string;
  busy: boolean;
}) {
  const px = `${Math.round(target.width * target.scale)} x ${Math.round(
    target.height * target.scale
  )}`;

  return (
    <Sheet visible={visible} onClose={onClose} title="Save">
      <SheetRow
        label={busy ? "Rendering…" : "Save to Photos"}
        sub={`PNG ${px}, native resolution`}
        primary
        onPress={busy ? undefined : onSave}
      />
      <SheetRow label="Share" onPress={busy ? undefined : onShare} />

      <SheetLabel>Format</SheetLabel>
      <ScrollView style={styles.targets} contentContainerStyle={styles.targetsInner}>
        <SheetRow
          label="This device"
          sub={detectedLabel}
          right={targetId === "auto" ? "✓" : undefined}
          onPress={() => onPickTarget("auto")}
        />
        {DEVICE_PRESETS.map((p) => (
          <SheetRow
            key={p.id}
            label={p.label}
            sub={p.sub}
            right={targetId === p.id ? "✓" : undefined}
            onPress={() => onPickTarget(p.id)}
          />
        ))}
      </ScrollView>

      <Text style={styles.hint}>
        Once saved: Settings, then Wallpaper. Do not crop, and leave perspective zoom off. That is
        what shifts the mask.
      </Text>
    </Sheet>
  );
}

// -- Support (shake) ---------------------------------------------------------

export function SupportSheet({
  visible,
  onClose,
  geometry,
}: {
  visible: boolean;
  onClose: () => void;
  geometry: Geometry;
}) {
  const diagnostics = [
    `${Application.applicationName ?? "Hide The Notch"} ${Application.nativeApplicationVersion ?? "?"} (${
      Application.nativeBuildVersion ?? "?"
    })`,
    `${Platform.OS} ${Platform.Version}`,
    `${geometry.label}, ${geometry.width}x${geometry.height}@${geometry.scale}x`,
    `cutout ${geometry.kind}${geometry.estimated ? " (inferred)" : ""}, insets ${geometry.insetTop}/${geometry.insetBottom}`,
  ].join("\n");

  const mailto =
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent("Hide The Notch, support")}` +
    `&body=${encodeURIComponent(`\n\n---\n${diagnostics}\n`)}`;

  return (
    <Sheet visible={visible} onClose={onClose} title="Something wrong?">
      <SheetRow
        label="Email support"
        sub={SUPPORT_EMAIL}
        primary
        onPress={() => void Linking.openURL(mailto)}
      />
      <SheetRow label="App website" sub={WEBSITE} onPress={() => void Linking.openURL(WEBSITE)} />
      <SheetLabel>What will be attached</SheetLabel>
      <View style={styles.diagBox}>
        <Text style={styles.diag}>{diagnostics}</Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  targets: { maxHeight: 210 },
  targetsInner: { gap: 8, paddingBottom: 4 },
  hint: { color: T.textDim, fontSize: 12, lineHeight: 17, marginTop: 10 },
  diagBox: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    padding: 12,
  },
  diag: { color: T.textDim, fontSize: 11, lineHeight: 16 },
});
