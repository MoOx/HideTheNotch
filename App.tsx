import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { GestureDetector, GestureHandlerRootView, Gesture } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useImage } from "@shopify/react-native-skia";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";

import { DEVICE_PRESETS, geometryFromPreset, type Geometry } from "./src/geometry/devices";
import { useDeviceGeometry } from "./src/geometry/useGeometry";
import { defaultMask } from "./src/recipe/defaults";
import {
  FAMILY_ORDER,
  type GradientPresetId,
  type Mask,
  type MaskFamily,
  type Recipe,
  type Source,
} from "./src/recipe/types";
import {
  barMaxHeight,
  barMinHeight,
  fadeSolidEnd,
  type DrawContext,
} from "./src/render/draw";
import { renderToFile, saveToPhotos } from "./src/render/export";
import { BUTTON, CornerButton } from "./src/ui/CornerButton";
import { CurvePicker, type CurveId } from "./src/ui/CurvePicker";
import { FamilyDots } from "./src/ui/FamilyDots";
import { MainSlider } from "./src/ui/MainSlider";
import { Preview } from "./src/ui/Preview";
import { ExportSheet, SourceSheet, SupportSheet } from "./src/ui/sheets";
import { useShake } from "./src/hooks/useShake";

/**
 * What the one slider drives, per family, and the range it drives it over.
 *
 * Everything the user can set now goes through here. A family that cannot state
 * its setting as a single number between two bounds does not get a second
 * control, it gets a better setting.
 */
function slider(mask: Mask, g: Geometry) {
  switch (mask.type) {
    case "bar": {
      const min = barMinHeight(g);
      const max = barMaxHeight(g);
      return {
        label: "Height",
        value: (mask.height - min) / (max - min),
        apply: (v: number): Mask => ({ ...mask, height: min + v * (max - min) }),
      };
    }
    case "stripes":
      return {
        label: "Density",
        value: mask.density,
        apply: (v: number): Mask => ({ ...mask, density: v }),
      };
    case "fade": {
      const min = fadeSolidEnd(g) + 40;
      const max = g.height * 0.8;
      return {
        label: "Fade",
        value: (mask.fadeEnd - min) / (max - min),
        apply: (v: number): Mask => ({ ...mask, fadeEnd: min + v * (max - min) }),
      };
    }
  }
}

function Editor() {
  const insets = useSafeAreaInsets();
  const detected = useDeviceGeometry();

  const [targetId, setTargetId] = useState("auto");
  const geometry: Geometry = useMemo(() => {
    if (targetId === "auto") return detected;
    const p = DEVICE_PRESETS.find((d) => d.id === targetId);
    return p ? geometryFromPreset(p) : detected;
  }, [targetId, detected]);

  const [family, setFamily] = useState<MaskFamily>("bar");
  const [masks, setMasks] = useState<Record<MaskFamily, Mask>>(() => ({
    bar: defaultMask("bar", detected),
    stripes: defaultMask("stripes", detected),
    fade: defaultMask("fade", detected),
  }));
  const [source, setSource] = useState<Source>({
    type: "gradient",
    preset: "aurora",
    seed: 1,
  });

  // Changing the target device changes the constraints, so we go back to that
  // device's defaults rather than keeping settings that have become wrong.
  const geomKey = `${geometry.width}x${geometry.height}:${geometry.kind}`;
  useEffect(() => {
    setMasks({
      bar: defaultMask("bar", geometry),
      stripes: defaultMask("stripes", geometry),
      fade: defaultMask("fade", geometry),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geomKey]);

  const [sourceOpen, setSourceOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bare, setBare] = useState(false);

  useShake(() => setSupportOpen(true), !busy);

  const image = useImage(source.type === "photo" ? source.uri : null);

  const recipe: Recipe = useMemo(
    () => ({ source, mask: masks[family] }),
    [source, masks, family]
  );
  const ctx: DrawContext = useMemo(
    () => ({ recipe, geometry, image: image ?? null }),
    [recipe, geometry, image]
  );

  const setMask = useCallback(
    (m: Mask) => setMasks((prev) => ({ ...prev, [m.type]: m })),
    []
  );

  const step = useCallback((dir: 1 | -1) => {
    setFamily((f) => {
      const i = FAMILY_ORDER.indexOf(f);
      return FAMILY_ORDER[(i + dir + FAMILY_ORDER.length) % FAMILY_ORDER.length];
    });
    void Haptics.selectionAsync();
  }, []);

  // Swiping left and right changes family. A long press strips the screen back
  // to the wallpaper alone, interface and sketched icons included, which is the
  // only way to judge the result on its own.
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-24, 24])
        .failOffsetY([-18, 18])
        .onEnd((e) => {
          if (Math.abs(e.translationX) > 48) step(e.translationX < 0 ? 1 : -1);
        }),
    [step]
  );
  const peek = useMemo(
    () =>
      Gesture.LongPress()
        .runOnJS(true)
        .minDuration(280)
        .onStart(() => setBare(true))
        .onFinalize(() => setBare(false)),
    []
  );
  const canvasGestures = useMemo(() => Gesture.Race(swipe, peek), [swipe, peek]);

  const pickPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photo access denied", "Allow access in Settings to import an image.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      exif: false,
    });
    if (!res.canceled && res.assets[0]) {
      setSource({ type: "photo", uri: res.assets[0].uri, dx: 0, dy: 0, zoom: 1 });
      setSourceOpen(false);
    }
  }, []);

  const save = useCallback(async () => {
    setBusy(true);
    const outcome = await saveToPhotos(ctx);
    setBusy(false);
    if (outcome.ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setExportOpen(false);
      Alert.alert(
        "Saved",
        `${outcome.result.widthPx} x ${outcome.result.heightPx} px in your photos.\n\n` +
          "Settings, then Wallpaper. Do not crop, and leave perspective zoom off."
      );
    } else if (outcome.reason === "permission") {
      Alert.alert("Photo access denied", "Allow access in Settings to save.");
    } else {
      Alert.alert("Export failed", outcome.message ?? "Unknown error");
    }
  }, [ctx]);

  const share = useCallback(async () => {
    setBusy(true);
    try {
      const file = renderToFile(ctx);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: "image/png" });
      }
    } catch (e) {
      Alert.alert("Share failed", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [ctx]);

  const mask = masks[family];
  const control = slider(mask, geometry);
  const bottom = Math.max(insets.bottom, 14);
  // The second row sits directly above the buttons: main control on the right,
  // whatever the family needs on the left, family dots between them.
  const secondRow = bottom + BUTTON + 16;

  return (
    <View style={styles.root}>
      <GestureDetector gesture={canvasGestures}>
        <View style={StyleSheet.absoluteFill}>
          <Preview ctx={ctx} homeScreen={!bare} />
        </View>
      </GestureDetector>

      {!bare && (
        <>
          <View style={[styles.dots, { bottom: bottom + BUTTON / 2 - 4 }]}>
            <FamilyDots family={family} />
          </View>

          <View style={[styles.slider, { bottom: secondRow }]}>
            <MainSlider
              label={control.label}
              value={control.value}
              onChange={(v) => setMask(control.apply(v))}
            />
          </View>

          {mask.type === "fade" && (
            <View style={[styles.left, { bottom: secondRow }]}>
              <CurvePicker
                value={mask.curve as CurveId}
                onChange={(curve) => setMask({ ...mask, curve })}
              />
            </View>
          )}

          <View style={[styles.left, { bottom }]}>
            <CornerButton icon="photo" label="Source" onPress={() => setSourceOpen(true)} />
          </View>
          <View style={[styles.right, { bottom }]}>
            <CornerButton icon="save" label="Save" onPress={() => setExportOpen(true)} />
          </View>
        </>
      )}

      <SourceSheet
        visible={sourceOpen}
        onClose={() => setSourceOpen(false)}
        onPickPhoto={() => void pickPhoto()}
        onPickPalette={(preset: GradientPresetId) => {
          setSource({ type: "gradient", preset, seed: 1 });
          setSourceOpen(false);
        }}
        current={source.type === "photo" ? "photo" : source.preset}
      />

      <ExportSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        onSave={() => void save()}
        onShare={() => void share()}
        target={geometry}
        targetId={targetId}
        onPickTarget={setTargetId}
        detectedLabel={`${detected.label}, ${detected.width}x${detected.height}`}
        busy={busy}
      />

      <SupportSheet
        visible={supportOpen}
        onClose={() => setSupportOpen(false)}
        geometry={detected}
      />

      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <Editor />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  left: { position: "absolute", left: 16 },
  right: { position: "absolute", right: 16 },
  slider: { position: "absolute", right: 16 },
  dots: { position: "absolute", left: 0, right: 0, alignItems: "center" },
});
