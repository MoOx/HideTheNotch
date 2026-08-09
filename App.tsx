import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { GestureDetector, GestureHandlerRootView, Gesture } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useImage } from "@shopify/react-native-skia";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";

import {
  cutoutBottom,
  DEVICE_PRESETS,
  geometryFromPreset,
  type Geometry,
} from "./src/geometry/devices";
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
import type { DrawContext } from "./src/render/draw";
import { renderToFile, saveToPhotos } from "./src/render/export";
import { ActionBar, ControlStrip } from "./src/ui/chrome";
import { DragHandle } from "./src/ui/DragHandle";
import { Preview } from "./src/ui/Preview";
import { ExportSheet, SourceSheet, SupportSheet } from "./src/ui/sheets";
import { useShake } from "./src/hooks/useShake";

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
  const [chromeHidden, setChromeHidden] = useState(false);

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

  // Swiping left and right changes family, a long press hides the interface so
  // the wallpaper can be judged on its own.
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
        .onStart(() => setChromeHidden(true))
        .onFinalize(() => setChromeHidden(false)),
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
  const floor = cutoutBottom(geometry);
  const snaps = [floor, geometry.insetTop].filter((v) => v > 0);

  return (
    <View style={styles.root}>
      <GestureDetector gesture={canvasGestures}>
        <View style={StyleSheet.absoluteFill}>
          <Preview ctx={ctx} />
        </View>
      </GestureDetector>

      {!chromeHidden && mask.type === "bar" && (
        <DragHandle
          y={mask.height}
          label="Height"
          min={Math.max(floor, 1)}
          max={geometry.height * 0.45}
          snaps={snaps}
          onChange={(height) => setMask({ ...mask, height })}
        />
      )}

      {!chromeHidden && mask.type === "fade" && (
        <>
          <DragHandle
            y={mask.solidEnd}
            label="End of black"
            min={Math.max(floor, 1)}
            max={mask.fadeEnd - 20}
            snaps={snaps}
            onChange={(solidEnd) => setMask({ ...mask, solidEnd })}
          />
          <DragHandle
            y={mask.fadeEnd}
            label="End of fade"
            min={mask.solidEnd + 20}
            max={geometry.height * 0.8}
            onChange={(fadeEnd) => setMask({ ...mask, fadeEnd })}
          />
        </>
      )}

      {!chromeHidden && (
        <View style={[styles.chrome, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <ControlStrip mask={mask} onChange={setMask} />
          <ActionBar
            family={family}
            onSource={() => setSourceOpen(true)}
            onExport={() => setExportOpen(true)}
          />
        </View>
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
  chrome: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    gap: 8,
  },
});
