import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { GestureDetector, GestureHandlerRootView, Gesture } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";

import type { Geometry } from "./src/geometry/devices";
import { useDeviceGeometry } from "./src/geometry/useGeometry";
import { defaultMask } from "./src/recipe/defaults";
import {
  FAMILY_LABEL,
  FAMILY_ORDER,
  type GradientPresetId,
  type Mask,
  type MaskFamily,
  type Recipe,
  type Source,
} from "./src/recipe/types";
import type { SFSymbol } from "expo-symbols";

import { barMaxHeight, barMinHeight, fadeSolidEnd, type DrawContext } from "./src/render/draw";
import { presetSource } from "./src/render/palettes";
import { renderToFile, saveToPhotos } from "./src/render/export";
import { useSourceImage } from "./src/render/useSourceImage";
import { BUTTON, CornerButton } from "./src/ui/CornerButton";
import { CurvePicker, type CurveId } from "./src/ui/CurvePicker";
import { DecorPicker } from "./src/ui/DecorPicker";
import { MeshEditor } from "./src/ui/MeshEditor";
import { FamilyDots } from "./src/ui/FamilyDots";
import { SLIDER_H_SHORT, VSlider } from "./src/ui/VSlider";
import { HomeScreenLayer, Preview } from "./src/ui/Preview";
import { ExportSheet, SourceSheet, SupportSheet } from "./src/ui/sheets";
import { useShake } from "./src/hooks/useShake";

/**
 * What the one slider drives, per family, and the range it drives it over.
 *
 * Everything the user can set now goes through here. A family that cannot state
 * its setting as a single number between two bounds does not get a second
 * control, it gets a better setting.
 */
type Control = {
  label: string;
  symbol: SFSymbol;
  value: number;
  apply: (v: number) => Mask;
};

function slider(mask: Mask, g: Geometry): Control {
  switch (mask.type) {
    case "bar": {
      const min = barMinHeight(g);
      const max = barMaxHeight(g);
      return {
        label: FAMILY_LABEL.bar,
        symbol: "rectangle.topthird.inset.filled",
        value: (mask.height - min) / (max - min),
        apply: (v) => ({ ...mask, height: min + v * (max - min) }),
      };
    }
    case "stripes":
      return {
        label: FAMILY_LABEL.stripes,
        symbol: "line.3.horizontal",
        value: mask.density,
        apply: (v) => ({ ...mask, density: v }),
      };
    case "decor":
      return {
        label: FAMILY_LABEL.decor,
        symbol: "sparkles",
        value: mask.density,
        apply: (v) => ({ ...mask, density: v }),
      };
    case "fade": {
      const min = fadeSolidEnd(g) + 40;
      // All the way to the bottom edge: a fade that stops at four fifths has a
      // last fifth of untouched wallpaper under it, which is a seam.
      const max = g.height;
      return {
        label: FAMILY_LABEL.fade,
        symbol: "rectangle.tophalf.filled",
        value: (mask.fadeEnd - min) / (max - min),
        apply: (v) => ({ ...mask, fadeEnd: min + v * (max - min) }),
      };
    }
  }
}

function Editor() {
  const insets = useSafeAreaInsets();
  const detected = useDeviceGeometry();

  const geometry: Geometry = detected;

  const [family, setFamily] = useState<MaskFamily>(FAMILY_ORDER[0]);
  const [masks, setMasks] = useState<Record<MaskFamily, Mask>>(() => ({
    bar: defaultMask("bar", detected),
    stripes: defaultMask("stripes", detected),
    fade: defaultMask("fade", detected),
    decor: defaultMask("decor", detected),
  }));
  const [source, setSource] = useState<Source>(() => presetSource("aurora"));

  // Which gradient point is being worked on, and whether we are in the editor
  // at all. Both live here rather than in the editor so that leaving and coming
  // back does not reset the selection, and so the gestures below can be told to
  // stand down without asking a child what it is doing.
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);

  // Changing the target device changes the constraints, so we go back to that
  // device's defaults rather than keeping settings that have become wrong.
  const geomKey = `${geometry.width}x${geometry.height}:${geometry.kind}`;
  useEffect(() => {
    setMasks({
      bar: defaultMask("bar", geometry),
      stripes: defaultMask("stripes", geometry),
      fade: defaultMask("fade", geometry),
      decor: defaultMask("decor", geometry),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geomKey]);

  const [sourceOpen, setSourceOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Pressing the wallpaper swaps one view for the other: the sketched home
  // screen appears, the interface gets out of the way. Holding is how you ask
  // "what will this actually look like", and the answer should not have buttons
  // on top of it.
  const [peeking, setPeeking] = useState(false);
  const peekT = useSharedValue(0);
  useEffect(() => {
    peekT.value = withTiming(peeking ? 1 : 0, { duration: 170 });
  }, [peeking, peekT]);
  // The editor takes the screen over the same way the peek does, and for the
  // same reason: the sliders belong to the mask, and while the gradient is
  // being placed they are furniture in front of the thing being judged.
  const hideT = useSharedValue(0);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: (1 - peekT.value) * (1 - hideT.value) }));
  const homeStyle = useAnimatedStyle(() => ({ opacity: peekT.value }));

  useEffect(() => {
    hideT.value = withTiming(editing ? 1 : 0, { duration: 200 });
  }, [editing, hideT]);

  useShake(() => setSupportOpen(true), !busy);

  const { image, error: imageError } = useSourceImage(source.type === "photo" ? source.uri : null);

  // A photo that fails to load used to leave the screen unchanged, which reads
  // as the app ignoring the tap. Say so instead, and fall back to where we were.
  useEffect(() => {
    if (imageError) {
      Alert.alert("That photo could not be opened", imageError);
      setSource(presetSource("aurora"));
    }
  }, [imageError]);

  const recipe: Recipe = useMemo(() => ({ source, mask: masks[family] }), [source, masks, family]);
  const ctx: DrawContext = useMemo(() => ({ recipe, geometry, image }), [recipe, geometry, image]);

  const setMask = useCallback((m: Mask) => setMasks((prev) => ({ ...prev, [m.type]: m })), []);

  const mask = masks[family];
  const control = slider(mask, geometry);

  // -- The wallpaper as a set of pages ---------------------------------------
  //
  // The families sit side by side and slide, the way home screen pages do,
  // rather than being swapped out from under the finger. The gesture picks its
  // axis on the first few points of movement and keeps it: sideways pages,
  // up and down drives the same value the slider drives, so the main setting is
  // adjustable without reaching for anything.
  const W = geometry.width;
  const index = FAMILY_ORDER.indexOf(family);
  const pageX = useSharedValue(-index * W);
  const axis = useSharedValue(0);
  const pageFrom = useSharedValue(0);

  useEffect(() => {
    pageX.value = withTiming(-index * W, { duration: 260 });
  }, [index, W, pageX]);

  const controlRef = useRef(control);
  controlRef.current = control;
  const paramFrom = useRef(0);

  const beginParam = useCallback(() => {
    paramFrom.current = controlRef.current.value;
  }, []);
  const applyParam = useCallback(
    (dy: number) => {
      // Down, not up. The slider fills upward because that is what a level
      // does, but on the wallpaper itself the finger is pushing the black
      // around: dragging down should send it down.
      const v = Math.min(1, Math.max(0, paramFrom.current + dy / PARAM_TRAVEL));
      setMask(controlRef.current.apply(v));
    },
    [setMask],
  );
  const commitFamily = useCallback((i: number) => {
    setFamily((prev) => {
      const next = FAMILY_ORDER[i];
      if (prev !== next) {
        void Haptics.selectionAsync();
      }
      return next;
    });
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // In the editor the wallpaper is the control surface: a drag belongs to
        // whichever point is under the finger, and paging to the next effect
        // in the middle of placing a colour would be the app taking the gesture
        // back.
        .enabled(!editing)
        .onBegin(() => {
          "worklet";
          axis.value = 0;
          pageFrom.value = pageX.value;
          runOnJS(beginParam)();
        })
        .onUpdate((e) => {
          "worklet";
          if (axis.value === 0) {
            if (Math.abs(e.translationX) < 8 && Math.abs(e.translationY) < 8) {
              return;
            }
            axis.value = Math.abs(e.translationX) > Math.abs(e.translationY) ? 1 : 2;
          }
          if (axis.value === 1) {
            const last = -(FAMILY_ORDER.length - 1) * W;
            pageX.value = Math.min(0, Math.max(last, pageFrom.value + e.translationX));
          } else {
            runOnJS(applyParam)(e.translationY);
          }
        })
        .onEnd((e) => {
          "worklet";
          if (axis.value !== 1) {
            return;
          }
          const raw = -pageX.value / W;
          let target = Math.round(raw);
          if (e.velocityX < -500) {
            target = Math.ceil(raw);
          } else if (e.velocityX > 500) {
            target = Math.floor(raw);
          }
          target = Math.min(FAMILY_ORDER.length - 1, Math.max(0, target));
          pageX.value = withTiming(-target * W, { duration: 220 });
          runOnJS(commitFamily)(target);
        }),
    [W, axis, pageFrom, pageX, beginParam, applyParam, commitFamily, editing],
  );

  const peek = useMemo(
    () =>
      Gesture.LongPress()
        .runOnJS(true)
        .enabled(!editing)
        .minDuration(150)
        .onStart(() => setPeeking(true))
        .onFinalize(() => setPeeking(false)),
    [editing],
  );
  const canvasGestures = useMemo(() => Gesture.Race(pan, peek), [pan, peek]);
  const pagerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pageX.value }] }));

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
      // iPhones shoot HEIC, and the picker hands back the container untouched
      // when the asset already is one. Skia has no HEIC decoder, so every photo
      // taken with the phone failed to open. "Compatible" asks the system for a
      // JPEG representation instead, which it transcodes itself, losslessly as
      // far as we are concerned since quality stays at 1.
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (!res.canceled && res.assets[0]) {
      setEditing(false);
      setSource({
        type: "photo",
        uri: res.assets[0].uri,
        dx: 0,
        dy: 0,
        zoom: 1,
      });
    }
  }, []);

  // The picker is a presented controller and so is the sheet. Asking for one
  // while the other is up is the kind of thing that works until it does not, so
  // the sheet closes first and the picker follows once it is out of the way.
  const [pendingPick, setPendingPick] = useState(false);
  useEffect(() => {
    if (!pendingPick || sourceOpen) {
      return;
    }
    const t = setTimeout(() => {
      setPendingPick(false);
      void pickPhoto();
    }, 320);
    return () => clearTimeout(t);
  }, [pendingPick, sourceOpen, pickPhoto]);

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
          "Settings, then Wallpaper. Do not crop, and leave perspective zoom off.",
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

  const bottom = Math.max(insets.bottom, 14);
  // One column on the right, read from the bottom up: export button, main
  // slider, and above it whatever else the family needs. Side by side the two
  // controls competed for the same glance; stacked, the one that matters is
  // the one nearest the thumb.
  const secondRow = bottom + BUTTON + 16;

  return (
    <View style={styles.root}>
      <GestureDetector gesture={canvasGestures}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.pager, { width: W * FAMILY_ORDER.length }, pagerStyle]}>
            {FAMILY_ORDER.map((f) => (
              <View key={f} style={{ width: W }}>
                {/* In the editor only the page being looked at is drawn. A drag
                    changes the source on every frame, and the source is what
                    all four pages share: left alone they would each redraw a
                    full screen of gradient per frame to sit still off screen,
                    where the pager cannot go because the gesture is off. */}
                {(!editing || f === family) && (
                  <Preview source={source} mask={masks[f]} geometry={geometry} image={image} />
                )}
              </View>
            ))}
          </Animated.View>
          {/* The icons do not travel with the pages: they are the room the
              wallpaper is being judged in, not one of the things on offer. */}
          <Animated.View style={[StyleSheet.absoluteFill, homeStyle]} pointerEvents="none">
            <HomeScreenLayer geometry={geometry} />
          </Animated.View>
        </View>
      </GestureDetector>

      {editing && source.type === "gradient" && (
        <MeshEditor
          points={source.points}
          selected={picked}
          geometry={geometry}
          bottom={bottom}
          // Moving a point makes it no longer the preset it came from, so the
          // row in the sheet stops claiming one is selected.
          onChange={(points) => setSource({ type: "gradient", preset: null, points })}
          onSelect={setPicked}
          onDone={() => {
            setEditing(false);
            setPicked(null);
          }}
        />
      )}

      <Animated.View
        style={[StyleSheet.absoluteFill, chromeStyle]}
        pointerEvents={peeking || editing ? "none" : "box-none"}
      >
        <View style={[styles.dots, { bottom: bottom + BUTTON / 2 - 4 }]}>
          <FamilyDots family={family} />
        </View>

        <View style={[styles.right, styles.column, { bottom: secondRow }]}>
          {mask.type === "fade" && (
            <CurvePicker
              value={mask.curve as CurveId}
              onChange={(curve) => setMask({ ...mask, curve })}
            />
          )}

          {mask.type === "decor" && (
            <DecorPicker
              value={mask.pattern}
              // Tapping the pattern you are already on reshuffles it. The seed
              // needs a control and this is the one place it can live without
              // adding a button that would need explaining.
              onChange={(pattern) =>
                setMask(
                  pattern === mask.pattern
                    ? { ...mask, seed: mask.seed + 1 }
                    : { ...mask, pattern },
                )
              }
            />
          )}

          {mask.type === "bar" && (
            <VSlider
              label="Corner"
              symbol="square.on.square"
              height={SLIDER_H_SHORT}
              value={mask.corner}
              onChange={(corner) => setMask({ ...mask, corner })}
            />
          )}

          <VSlider
            label={control.label}
            symbol={control.symbol}
            value={control.value}
            onChange={(v) => setMask(control.apply(v))}
          />
        </View>

        <View style={[styles.left, { bottom }]}>
          <CornerButton icon="photo" label="Wallpaper" onPress={() => setSourceOpen(true)} />
        </View>
        <View style={[styles.right, { bottom }]}>
          <CornerButton icon="export" label="Export" onPress={() => setExportOpen(true)} />
        </View>
      </Animated.View>

      <SourceSheet
        visible={sourceOpen}
        onClose={() => setSourceOpen(false)}
        onPickPhoto={() => {
          setPendingPick(true);
          setSourceOpen(false);
        }}
        // The sheet stays up: picking a gradient and then trying it against
        // each effect is one continuous act, and closing after every tap turns
        // it into three.
        onPickPalette={(preset: GradientPresetId) => setSource(presetSource(preset))}
        onEditGradient={() => {
          setSourceOpen(false);
          setEditing(true);
        }}
        current={source.type === "photo" ? "photo" : source.preset}
        geometry={geometry}
        mask={mask}
        source={source}
        masks={masks}
        family={family}
        onPickFamily={setFamily}
      />

      <ExportSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        onSave={() => void save()}
        onShare={() => void share()}
        target={geometry}
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

/** How far the finger travels for the full range of the main setting. */
const PARAM_TRAVEL = 300;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  pager: { position: "absolute", top: 0, bottom: 0, left: 0, flexDirection: "row" },
  left: { position: "absolute", left: 16 },
  right: { position: "absolute", right: 16 },
  column: { alignItems: "center", gap: 14 },
  dots: { position: "absolute", left: 0, right: 0, alignItems: "center" },
});
