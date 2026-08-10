import { Linking, Platform } from "react-native";
import { BottomSheet, FieldGroup, ListItem, RNHostView, Text } from "@expo/ui";
import { listSectionMargins } from "@expo/ui/swift-ui/modifiers";
import * as Application from "expo-application";
import { SymbolView, type SFSymbol } from "expo-symbols";

import type { Geometry } from "../geometry/devices";
import type { GradientPresetId, Mask, MaskFamily, Source } from "../recipe/types";
import { EffectRow, PaletteRow } from "./Thumbs";

/**
 * Half the default inset grouped margin.
 *
 * A form inside a sheet inherits the full width inset of a settings screen,
 * which on a sheet leaves the content floating in a lot of nothing. iOS 26
 * only, and inert elsewhere.
 */
const TIGHT =
  Platform.OS === "ios" ? [listSectionMargins({ length: 10, edges: "horizontal" })] : [];

/**
 * Explicit heights rather than fit to content.
 *
 * A SwiftUI `Form` wants to fill its container, so a sheet asked to size itself
 * to one has nothing to measure. These fractions are what the content actually
 * needs, and they are the reason the export sheet is no longer half a screen of
 * empty space.
 */
const SHEET_WALLPAPER = [{ fraction: 0.62 }] as const;
const SHEET_EXPORT = [{ fraction: 0.36 }] as const;

const SUPPORT_EMAIL = "apps+hide-the-notch@moox.io";
const WEBSITE = "https://moox.io/apps/hide-the-notch";

/**
 * The three sheets, on the platform's own sheet and in the platform's own form.
 *
 * `BottomSheet` presents a SwiftUI sheet on iOS and a Material 3
 * `ModalBottomSheet` on Android; `FieldGroup` inside it is a SwiftUI `Form`
 * with real `Section`s, or its Compose equivalent. That is what supplies the
 * grouping, the insets, the separators and the section headers, all of which
 * were missing when the content was a bare column of rows: the text looked
 * like text because nothing around it was doing any work.
 */

const ICON = {
  photo: { ios: "photo" as SFSymbol, android: "image" as const },
  save: { ios: "square.and.arrow.down" as SFSymbol, android: "download" as const },
  share: { ios: "square.and.arrow.up" as SFSymbol, android: "ios_share" as const },
  mail: { ios: "envelope" as SFSymbol, android: "mail" as const },
  web: { ios: "safari" as SFSymbol, android: "public" as const },
};

/** Rows carry the same icon system as the rest of the app, see `CornerButton`. */
function Glyph({ icon }: { icon: keyof typeof ICON }) {
  return <SymbolView name={ICON[icon]} size={20} resizeMode="scaleAspectFit" />;
}

// -- Wallpaper ---------------------------------------------------------------

export function SourceSheet({
  visible,
  onClose,
  onPickPhoto,
  onPickPalette,
  current,
  geometry,
  mask,
  source,
  masks,
  family,
  onPickFamily,
}: {
  visible: boolean;
  onClose: () => void;
  onPickPhoto: () => void;
  onPickPalette: (id: GradientPresetId) => void;
  current: GradientPresetId | "photo" | null;
  geometry: Geometry;
  mask: Mask;
  source: Source;
  masks: Record<MaskFamily, Mask>;
  family: MaskFamily;
  onPickFamily: (f: MaskFamily) => void;
}) {
  return (
    <BottomSheet isPresented={visible} onDismiss={onClose} snapPoints={[...SHEET_WALLPAPER]}>
      <FieldGroup>
        <FieldGroup.Section title="Wallpaper" modifiers={TIGHT}>
          <ListItem
            onPress={onPickPhoto}
            leading={<Glyph icon="photo" />}
            supportingText={current === "photo" ? "Currently in use" : "From your library"}
          >
            Choose a photo
          </ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section title="Gradients" modifiers={TIGHT}>
          {/* The thumbnails are the picker: a row of names would say nothing
              about something whose entire content is how it looks. */}
          <RNHostView matchContents>
            <PaletteRow geometry={geometry} mask={mask} current={current} onPick={onPickPalette} />
          </RNHostView>
        </FieldGroup.Section>

        <FieldGroup.Section title="Effects" modifiers={TIGHT}>
          <RNHostView matchContents>
            <EffectRow
              geometry={geometry}
              source={source}
              masks={masks}
              current={family}
              onPick={onPickFamily}
            />
          </RNHostView>
        </FieldGroup.Section>
      </FieldGroup>
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
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  onShare: () => void;
  target: Geometry;
  busy: boolean;
}) {
  const px = `${Math.round(target.width * target.scale)} x ${Math.round(
    target.height * target.scale,
  )}`;

  return (
    <BottomSheet isPresented={visible} onDismiss={onClose} snapPoints={[...SHEET_EXPORT]}>
      <FieldGroup>
        <FieldGroup.Section title="Export" modifiers={TIGHT}>
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
          <FieldGroup.SectionFooter>
            <Text textStyle={{ fontSize: 12 }}>
              {"Settings, then Wallpaper. Do not crop, and leave perspective zoom off: " +
                "that is what shifts the mask."}
            </Text>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
      </FieldGroup>
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
    <BottomSheet isPresented={visible} onDismiss={onClose} snapPoints={[...SHEET_EXPORT]}>
      <FieldGroup>
        <FieldGroup.Section title="Support" modifiers={TIGHT}>
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
        </FieldGroup.Section>

        <FieldGroup.Section title="Attached to the email" modifiers={TIGHT}>
          <Text textStyle={{ fontSize: 12 }}>{diagnostics}</Text>
        </FieldGroup.Section>
      </FieldGroup>
    </BottomSheet>
  );
}
