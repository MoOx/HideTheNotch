import { Linking, Platform } from "react-native";
import { BottomSheet, Column, ListItem, ScrollView, Text } from "@expo/ui";
import * as Application from "expo-application";
import { SymbolView, type SFSymbol } from "expo-symbols";

import { DEVICE_PRESETS, type Geometry } from "../geometry/devices";
import { PALETTES } from "../render/palettes";
import type { GradientPresetId } from "../recipe/types";

const SUPPORT_EMAIL = "apps+hide-the-notch@moox.io";
const WEBSITE = "https://moox.io/apps/hide-the-notch";

/**
 * The three sheets, on the platform's own sheet.
 *
 * `BottomSheet` from `@expo/ui` presents a SwiftUI sheet on iOS and a Material
 * 3 `ModalBottomSheet` on Android, with the rows inside being real platform
 * rows rather than styled `View`s. This is where the difference between an app
 * that looks native and one that imitates it is most visible, because a sheet
 * is the component people recognise without looking.
 */

const ICON = {
  check: { ios: "checkmark" as SFSymbol, android: "check" as const },
  photo: { ios: "photo" as SFSymbol, android: "image" as const },
  save: { ios: "square.and.arrow.down" as SFSymbol, android: "download" as const },
  share: { ios: "square.and.arrow.up" as SFSymbol, android: "ios_share" as const },
  mail: { ios: "envelope" as SFSymbol, android: "mail" as const },
  web: { ios: "safari" as SFSymbol, android: "public" as const },
  phone: { ios: "iphone" as SFSymbol, android: "smartphone" as const },
};

/** Rows carry the same icon system as the rest of the app, see `CornerButton`. */
function Glyph({ icon, size = 20 }: { icon: keyof typeof ICON; size?: number }) {
  return <SymbolView name={ICON[icon]} size={size} />;
}

function Selected({ on }: { on: boolean }) {
  return on ? <Glyph icon="check" size={17} /> : null;
}

function SectionLabel({ children }: { children: string }) {
  return <Text textStyle={{ fontSize: 12, fontWeight: "600" }}>{children}</Text>;
}

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
    <BottomSheet isPresented={visible} onDismiss={onClose}>
      <Column spacing={2}>
        <ListItem
          onPress={onPickPhoto}
          leading={<Glyph icon="photo" />}
          supportingText="Pinch to reframe once imported"
          trailing={<Selected on={current === "photo"} />}
        >
          Choose a photo
        </ListItem>

        <SectionLabel>Gradients</SectionLabel>

        {PALETTES.map((p) => (
          <ListItem
            key={p.id}
            onPress={() => onPickPalette(p.id)}
            trailing={<Selected on={current === p.id} />}
          >
            {p.label}
          </ListItem>
        ))}
      </Column>
    </BottomSheet>
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
    <BottomSheet isPresented={visible} onDismiss={onClose} snapPoints={["half", "full"]}>
      {/* The device list is long by design: this is the one place where "for
          which phone?" is a real question, so it gets room rather than a picker. */}
      <ScrollView>
        <Column spacing={2}>
          <ListItem
            onPress={busy ? undefined : onSave}
            leading={<Glyph icon="save" />}
            supportingText={`PNG ${px}, native resolution`}
          >
            {busy ? "Rendering…" : "Save to Photos"}
          </ListItem>
          <ListItem onPress={busy ? undefined : onShare} leading={<Glyph icon="share" />}>
            Share
          </ListItem>

          <SectionLabel>Made for</SectionLabel>

          <ListItem
            onPress={() => onPickTarget("auto")}
            leading={<Glyph icon="phone" />}
            supportingText={detectedLabel}
            trailing={<Selected on={targetId === "auto"} />}
          >
            This device
          </ListItem>
          {DEVICE_PRESETS.map((p) => (
            <ListItem
              key={p.id}
              onPress={() => onPickTarget(p.id)}
              supportingText={p.sub}
              trailing={<Selected on={targetId === p.id} />}
            >
              {p.label}
            </ListItem>
          ))}

          <Text textStyle={{ fontSize: 12 }}>
            {"Once saved: Settings, then Wallpaper. Do not crop, and leave perspective zoom off. " +
              "That is what shifts the mask."}
          </Text>
        </Column>
      </ScrollView>
    </BottomSheet>
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
    `${Application.applicationName ?? "Hide The Notch"} ${
      Application.nativeApplicationVersion ?? "?"
    } (${Application.nativeBuildVersion ?? "?"})`,
    `${Platform.OS} ${Platform.Version}`,
    `${geometry.label}, ${geometry.width}x${geometry.height}@${geometry.scale}x`,
    `cutout ${geometry.kind}${geometry.estimated ? " (inferred)" : ""}, insets ${
      geometry.insetTop
    }/${geometry.insetBottom}`,
  ].join("\n");

  const mailto =
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent("Hide The Notch, support")}` +
    `&body=${encodeURIComponent(`\n\n---\n${diagnostics}\n`)}`;

  return (
    <BottomSheet isPresented={visible} onDismiss={onClose}>
      <Column spacing={2}>
        <ListItem
          onPress={() => void Linking.openURL(mailto)}
          leading={<Glyph icon="mail" />}
          supportingText={SUPPORT_EMAIL}
        >
          Email support
        </ListItem>
        <ListItem
          onPress={() => void Linking.openURL(WEBSITE)}
          leading={<Glyph icon="web" />}
          supportingText={WEBSITE}
        >
          App website
        </ListItem>

        <SectionLabel>What will be attached</SectionLabel>
        <Text textStyle={{ fontSize: 12 }}>{diagnostics}</Text>
      </Column>
    </BottomSheet>
  );
}
