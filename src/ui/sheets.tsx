import { Linking, Platform } from "react-native";
import { BottomSheet, FieldGroup, Switch, Text } from "@expo/ui";
import { listSectionMargins, padding } from "@expo/ui/swift-ui/modifiers";
import { padding as paddingCompose } from "@expo/ui/jetpack-compose/modifiers";
import * as Application from "expo-application";
import type { SkImage } from "@shopify/react-native-skia";
import { SymbolView, type SFSymbol } from "expo-symbols";

import type { Geometry } from "../geometry/devices";
import { locale, t, tp } from "../i18n";
import type { GradientPresetId, Mask, MaskFamily, Source } from "../recipe/types";
import { Row } from "./Row";
import { supporting } from "./supporting";
import { EffectRow, PaletteRow } from "./Thumbs";

/**
 * One surface, not two.
 *
 * `FieldGroup` on Android paints `surface` behind itself, inside a sheet that
 * is already painted `surfaceContainerLow`, so a second, differently dark
 * rectangle appeared inset from the sheet's own edges. Nothing is meant to be
 * seen there: the sheet is the surface, and the section cards are the only
 * thing that should stand on it.
 *
 * iOS does not have the problem: a `Form` paints its own grouped background,
 * which is the surface the cards are meant to stand on.
 */
const CLEAR = Platform.OS === "android" ? { backgroundColor: "transparent" } : undefined;

/**
 * Half the inset a settings screen would use.
 *
 * A `Form` inside a sheet inherits the full width inset of a full screen, which
 * on a sheet leaves the content floating in a lot of nothing. iOS 26 only, and
 * inert elsewhere: Android's spacing comes from Material's own list item, see
 * `Thumbs.tsx`.
 */
const TIGHT =
  Platform.OS === "ios" ? [listSectionMargins({ length: 16, edges: "horizontal" })] : undefined;

/**
 * The sheet's own padding, undone on all three sides.
 *
 * `@expo/ui` wraps a sheet's children in sixteen points a side. It is appended
 * to rather than replaced, and SwiftUI padding is cumulative, so the only way
 * out from here is to add minus the same. Negative insets are what SwiftUI does
 * with them, and the geometry comes out exactly neutral.
 *
 * The top one goes too, and that is what removes the white band. A `Form`
 * paints `systemGroupedBackground` behind itself and the sheet's own chrome is
 * `systemBackground`; those sixteen points were the one strip where the second
 * showed. Starting the form at the top of the sheet puts its background under
 * the grabber, which is where every sheet in Settings has it. The form's own
 * top inset still keeps the first section header clear of the grabber, so
 * nothing collides.
 *
 * `presentationBackground` was the other way to reach that strip and it is not
 * worth it: it paints a colour, a colour is not glass, and painting it only
 * when the sheet is expanded meant watching the sheet's geometry and setting
 * state from a native event while it was being presented, which locked the
 * sheet open and crashed.
 */
const EDGE =
  Platform.OS === "ios" ? [padding({ top: -16, leading: -16, trailing: -16 })] : undefined;

/**
 * The gap under the grabber, put back where it cannot show.
 *
 * Taking the sheet's top padding off is what puts the form's background under
 * the grabber, and it also puts the first section header there. The space has
 * to come back, but above the form it is a strip of the sheet's own chrome in a
 * different colour, which is the band that was there in the first place. So it
 * comes back inside: a top margin on the first section only, which the form
 * paints its own background behind.
 *
 * iOS 26, like the horizontal margins next to it, and inert below.
 */
const FIRST =
  Platform.OS === "ios"
    ? [...(TIGHT ?? []), listSectionMargins({ length: 28, edges: "top" })]
    : TIGHT;

/**
 * Half the inset the sheet gives its content on Android.
 *
 * Three insets stack there and only this one can be reached: `FieldGroup` pads
 * its lazy column and Material's `ListItem` pads its own content, both inside
 * components that expose no prop for it, and Compose has no negative padding to
 * undo either with. A sheet holding the same rows as the iOS one came out
 * noticeably looser.
 *
 * `contentModifiers` is not upstream's, it is `patches/@expo+ui+57.0.9.patch`:
 * the sheet's own padding yields to one supplied here rather than adding to it.
 * See the patch for what it is and why it should go upstream instead.
 */
const ROOMY = Platform.OS === "android" ? [paddingCompose(0, 0, 0, 0)] : undefined;

/**
 * How tall a sheet opens, and how much taller it can be pulled, which are two
 * different questions on the two platforms.
 *
 * On iOS a fraction is a height. The first detent is where the sheet opens, and
 * these are what the content actually needs; `full` is added after it so the
 * sheet can always be dragged up to the whole screen, which is what anyone
 * expects the moment a sheet has a grabber on it.
 *
 * On Android a fraction is not a height at all. Material's `ModalBottomSheet`
 * has two states, partially expanded and expanded, and it sizes itself to its
 * content; `@expo/ui` reads any fraction under 1 as "this sheet may rest
 * partially expanded", so every number we passed meant the same thing.
 *
 * So Android gets told which of the two states it wants, in its own words.
 * `half` for the sheet with three sections in it, which rests half way and
 * pulls up to the full screen: `full` on its own made a picker read as a page,
 * and half on its own cut the content off, because the content was laid out at
 * the resting height instead of the full one. Naming both gives Material the
 * full-height layout *and* the lower resting place. The two short sheets are
 * given nothing at all, which is expanded at content height: there is nothing
 * below the fold to drag up to.
 */
function sheet(ios: number, android: "half" | "content") {
  if (Platform.OS !== "android") {
    return [{ fraction: ios }, "full"] as const;
  }
  return android === "half" ? (["half", "full"] as const) : undefined;
}

const SHEET_WALLPAPER = sheet(0.62, "half");
const SHEET_EXPORT = sheet(0.36, "content");
/** Three rows and the diagnostics under them, rather than the export's two. */
const SHEET_SUPPORT = sheet(0.5, "content");

/**
 * Which commit this is, which no store number can say.
 *
 * The two stores keep two counters and they diverge the moment one platform
 * gets a build the other does not, so a build number cannot answer "are these
 * two the same app". Apple wants three integers and Google an increasing one,
 * so neither will take a hash as its number: it goes in the diagnostics
 * instead, where someone writing in reports it and both platforms report the
 * same value for the same code.
 *
 * Metro inlines `EXPO_PUBLIC_*` at bundling, so this is a literal in the
 * shipped bundle rather than a lookup. The lanes set it; a development build
 * has nothing to set it from and says so rather than inventing one.
 */
const COMMIT = process.env.EXPO_PUBLIC_COMMIT ?? "dev";

const SUPPORT_EMAIL = "apps+hide-the-notch@moox.io";
const WEBSITE = "https://moox.io/apps/hide-the-notch";

/**
 * The three sheets, on the platform's own sheet and in the platform's own form.
 *
 * `Sheet` presents a SwiftUI sheet on iOS and a Material 3
 * `ModalBottomSheet` on Android; `FieldGroup` inside it is a SwiftUI `Form`
 * with real `Section`s, or its Compose equivalent. That is what supplies the
 * grouping, the insets, the separators and the section headers, all of which
 * were missing when the content was a bare column of rows: the text looked
 * like text because nothing around it was doing any work.
 */

const ICON = {
  photo: { ios: "photo" as SFSymbol, android: "image" as const },
  save: {
    ios: "square.and.arrow.down" as SFSymbol,
    android: "download" as const,
  },
  share: {
    ios: "square.and.arrow.up" as SFSymbol,
    android: "ios_share" as const,
  },
  mail: { ios: "envelope" as SFSymbol, android: "mail" as const },
  web: { ios: "safari" as SFSymbol, android: "public" as const },
  points: { ios: "circle.grid.2x2" as SFSymbol, android: "gradient" as const },
  play: { ios: "play.circle" as SFSymbol, android: "play_circle" as const },
  help: { ios: "questionmark.circle" as SFSymbol, android: "help" as const },
  translate: {
    ios: "character.bubble" as SFSymbol,
    android: "translate" as const,
  },
  // A square with a line down the middle, which is the shape of the thing it
  // turns on. Material's own is called after the divider rather than the split.
  compare: { ios: "square.split.2x1" as SFSymbol, android: "vertical_split" as const },
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
  onEditGradient,
  current,
  geometry,
  mask,
  source,
  image,
  masks,
  family,
  onPickFamily,
}: {
  visible: boolean;
  onClose: () => void;
  onPickPhoto: () => void;
  onPickPalette: (id: GradientPresetId) => void;
  onEditGradient: () => void;
  current: GradientPresetId | "photo" | null;
  geometry: Geometry;
  mask: Mask;
  source: Source;
  image: SkImage | null;
  masks: Record<MaskFamily, Mask>;
  family: MaskFamily;
  onPickFamily: (f: MaskFamily) => void;
}) {
  return (
    <BottomSheet
      isPresented={visible}
      onDismiss={onClose}
      snapPoints={SHEET_WALLPAPER ? [...SHEET_WALLPAPER] : undefined}
      modifiers={EDGE}
      contentModifiers={ROOMY}
    >
      <FieldGroup style={CLEAR}>
        <FieldGroup.Section title={t("wallpaper")} modifiers={FIRST}>
          <Row
            onPress={onPickPhoto}
            leading={<Glyph icon="photo" />}
            supportingText={supporting(
              current === "photo" ? t("photoInUse") : t("photoFromLibrary"),
            )}
          >
            {t("choosePhoto")}
          </Row>
        </FieldGroup.Section>

        <FieldGroup.Section title={t("gradients")} modifiers={TIGHT}>
          {/* The thumbnails are the picker: a row of names would say nothing
              about something whose entire content is how it looks. */}
          <PaletteRow geometry={geometry} mask={mask} current={current} onPick={onPickPalette} />
          {/* The row picks a starting point; this is where it stops being a
              preset. It reads as the next step down the section rather than as
              a mode, which is what it is: the same gradient, by its points. */}
          <Row
            onPress={source.type === "gradient" ? onEditGradient : undefined}
            leading={<Glyph icon="points" />}
            supportingText={supporting(
              source.type === "gradient"
                ? t("editColoursHint", { n: source.points.length })
                : t("pickGradientFirst"),
            )}
          >
            {t("editColours")}
          </Row>
        </FieldGroup.Section>

        <FieldGroup.Section title={t("effects")} modifiers={TIGHT}>
          <EffectRow
            geometry={geometry}
            source={source}
            image={image}
            masks={masks}
            current={family}
            onPick={onPickFamily}
          />
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
  onDemo,
  onSupport,
  target,
  busy,
  compare,
  onCompare,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  onShare: () => void;
  onDemo: () => void;
  onSupport: () => void;
  target: Geometry;
  busy: boolean;
  compare: boolean;
  onCompare: (on: boolean) => void;
}) {
  const px = `${Math.round(target.width * target.scale)} x ${Math.round(
    target.height * target.scale,
  )}`;

  return (
    <BottomSheet
      isPresented={visible}
      onDismiss={onClose}
      snapPoints={SHEET_EXPORT ? [...SHEET_EXPORT] : undefined}
      modifiers={EDGE}
      contentModifiers={ROOMY}
    >
      <FieldGroup style={CLEAR}>
        <FieldGroup.Section title={t("export")} modifiers={FIRST}>
          <Row
            onPress={busy ? undefined : onSave}
            leading={<Glyph icon="save" />}
            supportingText={supporting(t("exportSpec", { px }))}
          >
            {busy ? t("rendering") : t("saveToPhotos")}
          </Row>
          <Row onPress={busy ? undefined : onShare} leading={<Glyph icon="share" />}>
            {t("share")}
          </Row>
          <FieldGroup.SectionFooter>
            <Text textStyle={{ fontSize: 12 }}>{tp("exportHint")}</Text>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>

        {/* The two things with no affordance anywhere else: the app can show
            itself being used, and shaking asks for help. A sheet the user is
            already in is where they belong, rather than a settings screen this
            app does not have. */}
        <FieldGroup.Section title={t("theApp")} modifiers={TIGHT}>
          <Row
            onPress={onSupport}
            leading={<Glyph icon="help" />}
            supportingText={supporting(t("supportHint"))}
          >
            {t("support")}
          </Row>
          <Row
            onPress={onDemo}
            leading={<Glyph icon="play" />}
            supportingText={supporting(t("watchDemoHint"))}
          >
            {t("watchDemo")}
          </Row>
          {/* The one control that changes nothing about what is saved, which is
              why it sits with the app's own things and not with the export. It
              is a way of looking rather than a setting: you turn it on, you see
              what the effect did, you turn it off. */}
          <Row
            onPress={() => onCompare(!compare)}
            leading={<Glyph icon="compare" />}
            supportingText={supporting(t("compareHint"))}
            trailing={<Switch value={compare} onValueChange={onCompare} />}
          >
            {t("compare")}
          </Row>
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
    } (${Application.nativeBuildVersion ?? "?"}) ${COMMIT}`,
    `${Platform.OS} ${Platform.Version}`,
    `${geometry.label}, ${geometry.width}x${geometry.height}@${geometry.scale}x`,
    `cutout ${geometry.kind} from ${geometry.cutoutFrom}, insets ${geometry.insetTop}/${geometry.insetBottom}`,
  ].join("\n");

  const mailto =
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent(t("mailSupportSubject"))}` +
    `&body=${encodeURIComponent(`\n\n---\n${diagnostics}\n`)}`;

  // Five of the six languages are a first pass and want a native read. Asking
  // for the exact wording that is wrong, rather than for "feedback", is the
  // difference between a report that can be acted on and one that cannot: the
  // body arrives with the two questions already in it.
  const translationMailto =
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent(t("mailTranslationSubject"))}` +
    `&body=${encodeURIComponent(`${t("mailTranslationBody")}---\n${locale}\n${diagnostics}\n`)}`;

  return (
    <BottomSheet
      isPresented={visible}
      onDismiss={onClose}
      snapPoints={SHEET_SUPPORT ? [...SHEET_SUPPORT] : undefined}
      modifiers={EDGE}
      contentModifiers={ROOMY}
    >
      <FieldGroup style={CLEAR}>
        <FieldGroup.Section title={t("support")} modifiers={FIRST}>
          <Row
            onPress={() => void Linking.openURL(mailto)}
            leading={<Glyph icon="mail" />}
            supportingText={supporting(SUPPORT_EMAIL)}
          >
            {t("emailSupport")}
          </Row>
          <Row
            onPress={() => void Linking.openURL(WEBSITE)}
            leading={<Glyph icon="web" />}
            supportingText={supporting(WEBSITE)}
          >
            {t("appWebsite")}
          </Row>
          <Row
            onPress={() => void Linking.openURL(translationMailto)}
            leading={<Glyph icon="translate" />}
            supportingText={supporting(t("improveTranslationHint"))}
          >
            {t("improveTranslation")}
          </Row>
        </FieldGroup.Section>

        <FieldGroup.Section title={t("attached")} modifiers={TIGHT}>
          <Text textStyle={{ fontSize: 12 }}>{diagnostics}</Text>
        </FieldGroup.Section>
      </FieldGroup>
    </BottomSheet>
  );
}
