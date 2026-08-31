import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Linking, Platform, StyleSheet, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { GestureDetector, GestureHandlerRootView, Gesture } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";

import type { DemoSheet } from "./src/demo/script";
import { PHOTO_FRAMING, SHEET_SETTLE, SHOTS, type Shot } from "./src/demo/shots";
import { useDemo } from "./src/demo/useDemo";
import type { Geometry } from "./src/geometry/devices";
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
import type { SFSymbol } from "expo-symbols";

import {
  barMaxHeight,
  barMinHeight,
  clampFraming,
  fadeSolidEnd,
  type DrawContext,
} from "./src/render/draw";
import { presetSource } from "./src/render/palettes";
import { describeContext, renderToFile, saveToPhotos } from "./src/render/export";
import { useSourceImage } from "./src/render/useSourceImage";
import { report, reportGeometry } from "./src/report";
import { ADJUST, adjustStep } from "./src/ui/a11y";
import { BUTTON, CornerButton } from "./src/ui/CornerButton";
import { familyLabel, t, tp } from "./src/i18n";
import { DemoFinger } from "./src/ui/DemoFinger";
import { PARAM_TRAVEL } from "./src/ui/gestures";
import { CurvePicker, type CurveId } from "./src/ui/CurvePicker";
import { MeshEditor } from "./src/ui/MeshEditor";
import { FamilyDots } from "./src/ui/FamilyDots";
import { SLIDER_H_SHORT, VSlider } from "./src/ui/VSlider";
import { HomeGrid } from "./src/ui/HomeGrid";
import { Sweep, SWEEP } from "./src/ui/Sweep";
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
type Control = {
  label: string;
  symbol: SFSymbol;
  value: number;
  apply: (v: number) => Mask;
  /** Shown faintly at the head of the track, when the value is a real length. */
  readout?: string;
};

function slider(mask: Mask, g: Geometry): Control {
  switch (mask.type) {
    case "bar": {
      const min = barMinHeight(g);
      const max = barMaxHeight(g);
      return {
        label: familyLabel("bar"),
        // How far the black reaches, in points, read off the control while
        // watching the top of the phone: that is how the cutout table gets
        // corrected. One decimal, because the error being hunted is smaller
        // than a point.
        readout: `${mask.height.toFixed(1)}`,
        symbol: "rectangle.topthird.inset.filled",
        value: (mask.height - min) / (max - min),
        apply: (v) => ({ ...mask, height: min + v * (max - min) }),
      };
    }
    case "stripes":
      return {
        label: familyLabel("stripes"),
        symbol: "line.3.horizontal",
        value: mask.density,
        apply: (v) => ({ ...mask, density: v }),
      };
    case "fade": {
      // Twelve points of ramp at the bottom of the travel, not forty. The floor
      // is there so the fade stays a fade rather than becoming family 01 with a
      // soft edge, and twelve is enough for that: forty was enough to keep the
      // black visibly past where the bar stops even at the shortest setting the
      // control offered.
      const min = fadeSolidEnd(g) + 12;
      // All the way to the bottom edge: a fade that stops at four fifths has a
      // last fifth of untouched wallpaper under it, which is a seam.
      const max = g.height;
      return {
        label: familyLabel("fade"),
        symbol: "rectangle.tophalf.filled",
        value: (mask.fadeEnd - min) / (max - min),
        apply: (v) => ({ ...mask, fadeEnd: min + v * (max - min) }),
      };
    }
  }
}

/**
 * The photograph a shot asks for, carried rather than delivered.
 *
 * It used to arrive as a path in the capture URL, and that was two mistakes in
 * one. It was never used, since both platforms ended up on the bundled copy
 * below. And it was the only thing in the app that took a file name from
 * outside and opened it: `hidethenotch://` is a public scheme, so any web page
 * could name a path and be shown what was at it. Nothing outside is read now.
 *
 * The reason it is bundled rather than pushed, which is worth keeping:
 *
 * Android has nowhere to push to. `adb` can write to the app's external files
 * directory but not to its internal one, and `FilePermissionService` in
 * expo-modules-core grants read outright only for the internal `filesDir` and
 * `cacheDir`, falling back to `canRead()` for everything else. A file pushed
 * there comes out `-rw-r--r--` and still unreadable: `/sdcard` is a FUSE view
 * that answers by calling package rather than by mode, and nothing done from
 * the shell changes that. Shared storage is worse, since the app no longer
 * declares the permission that would open it, and rightly.
 *
 * So the photo is carried rather than delivered, as a bundled asset, and it is
 * asked for the way React Native asks for one rather than as a file.
 * `expo-asset` was the first attempt and it does not survive a release build on
 * Android: an image required from JavaScript is packed as a drawable there, so
 * `localUri` stays null and `uri` is a resource name, `assets_demophoto`, which
 * is not a path and cannot be made into one.
 *
 * `resolveAssetSource` returns exactly what the platform has, whatever that is:
 * a resource name on Android release, a bundle path on iOS, a development
 * server URL under Metro. Skia takes all three, since it is what backs
 * `useImage(require(...))`, and `useSourceImage` only asks the file system
 * about things shaped like files.
 *
 * It costs a quarter of a megabyte in every shipped build for something only a
 * screenshot uses. That is the price of a capture harness that cannot be broken
 * by a storage policy, and it is cheap next to what the alternatives cost to
 * keep working.
 *
 * The picture is my own cat, photographed by me, which is why nothing here
 * credits anybody: a store listing may only show what its publisher has the
 * right to show, and the cheapest way to hold that right is to own it. See
 * `tools/marketing/README.md`.
 */
function shotPhoto(): Source {
  const uri = Image.resolveAssetSource(require("./assets/demo-photo.jpg")).uri;
  return {
    type: "photo",
    // A path is made absolute; anything else is passed on as it came, because
    // only the platform knows what it means.
    uri: uri.startsWith("/") ? `file://${uri}` : uri,
    ...PHOTO_FRAMING,
  };
}

/**
 * A shot's recipe, laid over whatever the families currently hold.
 *
 * Pure, because it has to be applied from two places: straight away, and again
 * from the effect that resets the masks when the measured geometry arrives.
 */
function withShot(base: Record<MaskFamily, Mask>, shot: Shot, g: Geometry) {
  let next =
    shot.param === undefined ? base[shot.family] : slider(base[shot.family], g).apply(shot.param);
  if (next.type === "bar" && shot.corner !== undefined) {
    next = { ...next, corner: shot.corner };
  }
  return { ...base, [next.type]: next };
}

function Editor() {
  const insets = useSafeAreaInsets();
  const detected = useDeviceGeometry();

  // The device in your hand, and only that one. There is no target picker and
  // there is nothing to pick: a wallpaper is cut for one screen, and a capture
  // gets its cutout from the machine it runs on. See `tools/marketing/`.
  const geometry: Geometry = detected;

  const [family, setFamily] = useState<MaskFamily>(FAMILY_ORDER[0]);
  const [masks, setMasks] = useState<Record<MaskFamily, Mask>>(() => ({
    bar: defaultMask("bar", detected),
    stripes: defaultMask("stripes", detected),
    fade: defaultMask("fade", detected),
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
  // A shot that changed the target device wants its recipe on top of the new
  // defaults rather than under them, so it waits here for the reset it caused.
  const wanted = useRef<Shot | null>(null);
  useEffect(() => {
    const base = {
      bar: defaultMask("bar", geometry),
      stripes: defaultMask("stripes", geometry),
      fade: defaultMask("fade", geometry),
    };
    const shot = wanted.current;
    wanted.current = null;
    setMasks(shot ? withShot(base, shot, geometry) : base);
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
  // Preview only, and off by every time the app opens: it is a way of looking
  // at what the effect did, not a setting to be remembered.
  const [compare, setCompare] = useState(false);
  const peekT = useSharedValue(0);
  useEffect(() => {
    peekT.value = withTiming(peeking ? 1 : 0, SWEEP);
  }, [peeking, peekT]);
  // The editor takes the screen over the same way the peek does, and for the
  // same reason: the sliders belong to the mask, and while the gradient is
  // being placed they are furniture in front of the thing being judged.
  const hideT = useSharedValue(0);
  // The interface starts out of the way and arrives as the launch screen goes.
  const launchT = useSharedValue(1);
  // How far out of the way the interface is, whichever of the three asked.
  const asideT = useDerivedValue(() => Math.max(peekT.value, hideT.value, launchT.value));

  /**
   * The launch screen goes when there is something behind it, and not before.
   *
   * The launch image is the app's own aurora gradient, drawn by the same code
   * (`tools/brand.cjs`), so the system's own cross fade is all the transition
   * this needs: the gradient stays put, the black arrives at the top, the marks
   * go, the controls come in. It briefly had a layer of its own doing that in
   * JavaScript, which managed to be both a black flash and a logo the size of
   * the screen. The system had the fade all along.
   *
   * One frame after the first layout, because a laid out view is not yet a
   * painted one and the whole point is to hide nothing but a finished picture.
   */
  const shown = useRef(false);
  const revealApp = useCallback(() => {
    if (shown.current) {
      return;
    }
    shown.current = true;
    requestAnimationFrame(() => {
      void SplashScreen.hideAsync();
      launchT.value = withTiming(0, SWEEP);
    });
  }, [launchT]);

  useEffect(() => {
    hideT.value = withTiming(editing ? 1 : 0, SWEEP);
  }, [editing, hideT]);

  useShake(() => setSupportOpen(true), !busy);

  // What every report from this build will be read against. It changes once, a
  // moment after launch, when the native module answers and the geometry stops
  // being the safe area's guess.
  useEffect(() => reportGeometry(geometry), [geometry]);

  const { image, error: imageError } = useSourceImage(source.type === "photo" ? source.uri : null);

  // A photo that fails to load used to leave the screen unchanged, which reads
  // as the app ignoring the tap. Say so instead, and fall back to where we were.
  useEffect(() => {
    if (imageError) {
      // The message lists every path that was tried, which is what makes it
      // worth sending: the paths themselves are replaced on the way out, see
      // `beforeSend` in index.ts.
      report("photo.open", imageError);
      Alert.alert(t("photoFailed"), imageError);
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
  const H = geometry.height;
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

  const paramNotch = useRef(-1);

  const beginParam = useCallback(() => {
    paramFrom.current = controlRef.current.value;
    paramNotch.current = Math.round(controlRef.current.value * 10);
  }, []);
  const applyParam = useCallback(
    (dy: number) => {
      // Down, not up. The slider fills upward because that is what a level
      // does, but on the wallpaper itself the finger is pushing the black
      // around: dragging down should send it down.
      const v = Math.min(1, Math.max(0, paramFrom.current + dy / PARAM_TRAVEL));
      // The same tick every tenth as the slider gives, because it is the same
      // setting: the wallpaper is the control surface here, and a control that
      // is felt in one place and not the other is two controls.
      const notch = Math.round(v * 10);
      if (notch !== paramNotch.current) {
        paramNotch.current = notch;
        void Haptics.selectionAsync();
      }
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
        // One finger pages and sets the effect. Two frame the photo, which is
        // why the second finger has to end this rather than be ignored by it.
        .maxPointers(1)
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

  // -- Framing the photo ------------------------------------------------------
  //
  // Two fingers, because one is already spoken for: it pages between effects
  // and sets the one that is showing. Pinching is what everyone does to a photo
  // anyway, and it leaves every gesture the app already had exactly where it
  // was.
  //
  // Both gestures report a change since the last frame rather than a total
  // since they began, and both go through the same step. That is what lets them
  // run at once without fighting over the framing: neither owns a baseline that
  // the other can invalidate.
  const imageRef = useRef(image);
  imageRef.current = image;

  const stepFraming = useCallback(
    (k: number, fx: number, fy: number, mx: number, my: number) => {
      const img = imageRef.current;
      if (!img) {
        return;
      }
      setSource((prev) => {
        if (prev.type !== "photo") {
          return prev;
        }
        // The zoom is clamped first and the ratio recomputed from what it
        // actually became, so that a pinch pressed against either end stops
        // moving the picture instead of sliding it sideways.
        const wanted = clampFraming(img.width(), img.height(), W, H, {
          ...prev,
          zoom: prev.zoom * k,
        });
        const ratio = wanted.zoom / prev.zoom;
        // Zooming about the fingers rather than about the middle: the point
        // under them is the one being looked at, so it is the one that must
        // stay put.
        return {
          ...prev,
          ...clampFraming(img.width(), img.height(), W, H, {
            zoom: wanted.zoom,
            dx: ratio * prev.dx + (1 - ratio) * (fx - W / 2) + mx,
            dy: ratio * prev.dy + (1 - ratio) * (fy - H / 2) + my,
          }),
        };
      });
    },
    [W, H],
  );

  const framing = source.type === "photo" && !editing;
  // While two fingers are down there is no paging, so there is no reason for
  // the pages the finger is not on to redraw a full screen of photo per frame.
  const [reframing, setReframing] = useState(false);
  const lastScale = useSharedValue(1);
  const lastPan = useSharedValue({ x: 0, y: 0 });

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(framing)
        .onBegin(() => {
          "worklet";
          lastScale.value = 1;
          runOnJS(setReframing)(true);
        })
        .onUpdate((e) => {
          "worklet";
          const k = e.scale / lastScale.value;
          lastScale.value = e.scale;
          runOnJS(stepFraming)(k, e.focalX, e.focalY, 0, 0);
        })
        .onFinalize(() => {
          "worklet";
          runOnJS(setReframing)(false);
        }),
    [framing, lastScale, stepFraming],
  );

  const drag = useMemo(
    () =>
      Gesture.Pan()
        .enabled(framing)
        .minPointers(2)
        .onBegin(() => {
          "worklet";
          lastPan.value = { x: 0, y: 0 };
          runOnJS(setReframing)(true);
        })
        .onUpdate((e) => {
          "worklet";
          const mx = e.translationX - lastPan.value.x;
          const my = e.translationY - lastPan.value.y;
          lastPan.value = { x: e.translationX, y: e.translationY };
          runOnJS(stepFraming)(1, 0, 0, mx, my);
        })
        .onFinalize(() => {
          "worklet";
          runOnJS(setReframing)(false);
        }),
    [framing, lastPan, stepFraming],
  );

  const peek = useMemo(
    () =>
      Gesture.LongPress()
        .runOnJS(true)
        .enabled(!editing)
        // A held pinch is someone framing a photo, not someone asking to see it
        // without the interface.
        .numberOfPointers(1)
        .minDuration(150)
        .onStart(() => setPeeking(true))
        .onFinalize(() => setPeeking(false)),
    [editing],
  );
  const canvasGestures = useMemo(
    () => Gesture.Race(Gesture.Simultaneous(pinch, drag), pan, peek),
    [pinch, drag, pan, peek],
  );
  const pagerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pageX.value }] }));

  const pickPhoto = useCallback(async () => {
    // iOS only, and that is the point rather than an oversight. Android hands
    // the choosing to the system photo picker, which returns one item and
    // grants access to that item alone, so asking for the library first would
    // be asking for `READ_MEDIA_IMAGES`: a permission this app does not hold,
    // does not need, and that Play asks an app to justify. iOS has no such
    // picker, so there the library is asked for.
    if (Platform.OS === "ios") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t("photoDenied"), t("photoDeniedImport"));
        return;
      }
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

  const bottom = Math.max(insets.bottom, 14);
  // One column on the right, read from the bottom up: export button, main
  // slider, and above it whatever else the family needs. Side by side the two
  // controls competed for the same glance; stacked, the one that matters is
  // the one nearest the thumb.
  const secondRow = bottom + BUTTON + 16;

  // -- The demo --------------------------------------------------------------
  //
  // The script drives the app through the same setters the interface uses, so
  // it cannot show a state the app cannot reach. It is also what the App
  // Preview video records: see docs/2026-demo-mode-and-web.md.
  // Where the finger lands on each corner button. Not on the centre: a thumb
  // arrives from the middle of the screen and catches the button high and
  // inside, which is the one place a real touch reliably is and dead centre is
  // the one place it never is.
  const spots = useMemo(() => {
    const off = BUTTON * 0.2;
    const y = geometry.height - bottom - BUTTON / 2 - off;
    return {
      source: { x: 16 + BUTTON / 2 + off, y },
      export: { x: geometry.width - 16 - BUTTON / 2 - off, y },
    };
  }, [geometry.width, geometry.height, bottom]);

  const demo = useDemo(
    {
      family: setFamily,
      familyValue: () => family,
      param: (v) => setMask(controlRef.current.apply(v)),
      paramValue: () => controlRef.current.value,
      palette: (preset) => setSource(presetSource(preset)),
      sheet: (which: DemoSheet) => {
        setSourceOpen(which === "source");
        setExportOpen(which === "export");
      },
      peek: setPeeking,
    },
    geometry,
    spots,
  );

  /** Anything deliberate ends the demo: it is a demonstration, not a mode. */
  function stopThen<A extends unknown[]>(fn: (...args: A) => void) {
    return (...args: A) => {
      demo.stop();
      fn(...args);
    };
  }

  // A presented controller cannot be replaced by another while it is on its way
  // out, and that is true of the photo picker, of a second sheet, and of a demo
  // that opens sheets of its own. So anything that has to come after a sheet
  // waits for the screen to be clear.
  const [pending, setPending] = useState<null | "photo" | "support" | "demo">(null);
  const sheetOpen = sourceOpen || exportOpen || supportOpen;
  // Pulled out of `demo` so the dependency below is the function this actually
  // calls, rather than the object it hangs off.
  const { start: startDemoNow } = demo;
  useEffect(() => {
    if (!pending || sheetOpen) {
      return;
    }
    const timer = setTimeout(() => {
      setPending(null);
      if (pending === "photo") {
        void pickPhoto();
      } else if (pending === "support") {
        setSupportOpen(true);
      } else {
        startDemoNow();
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [pending, sheetOpen, pickPhoto, startDemoNow]);

  /**
   * Arrive at one of the states the store deck is photographed in.
   *
   * The setting goes through `slider()`, the same function the control uses,
   * rather than through the ref, which still points at the family we are
   * leaving. Everything else is the setter the interface calls.
   */
  const applyShot = useCallback(
    (shot: Shot) => {
      demo.stop();
      setAnnounce({ id: shot.id, photo: shot.photo === true, sheet: shot.sheet !== undefined });
      setCompare(shot.compare === true);
      setEditing(false);
      setSource(shot.photo ? shotPhoto() : presetSource(shot.palette));
      setFamily(shot.family);
      setPeeking(shot.peek === true);
      setSourceOpen(shot.sheet === "source");
      setExportOpen(shot.sheet === "export");
      // Both paths, deliberately: the effect above if the geometry is still
      // arriving, this one if it has already settled. They compute the same
      // thing, so running both is harmless.
      wanted.current = shot;
      setMasks((prev) => withShot(prev, shot, geometry));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geometry],
  );

  const startDemo = useRef(demo.start);
  startDemo.current = demo.start;
  const shotRef = useRef(applyShot);
  shotRef.current = applyShot;

  /**
   * What a capture asked for, however it asked for it.
   *
   * `hidethenotch://demo` plays the script and `hidethenotch://shot/02-import`
   * walks into one of the deck's states, on a release build, which is the whole
   * capture pipeline: no debug flag, no UI automation, no separate binary, and
   * the build being photographed is the build that ships.
   */
  const play = useCallback((asked: string | null) => {
    if (!asked) {
      return;
    }
    const shot = SHOTS.find((s) => asked.includes(s.id));
    if (shot) {
      shotRef.current(shot);
      return;
    }
    if (asked.includes("demo")) {
      startDemo.current();
    }
  }, []);

  /**
   * Saying, once, that the state a capture asked for is on screen.
   *
   * The alternative is a script guessing at how long a cold start takes, and a
   * guess is what produced black screenshots and sheets caught halfway through
   * their animation. So the app waits for what the shot actually asked for
   * before it claims anything: a photo is not on screen until it has decoded,
   * and a sheet is not up until it has finished coming up, which is the one
   * thing here that is a duration rather than an event, because neither
   * platform's sheet tells anyone when it lands.
   *
   * It is said twice, because the two capture runs can hear different things.
   * iOS reads a file out of the app's container, which is the only channel
   * `simctl` has. Android reads the log, which is the only one `adb` has
   * against a release build.
   */
  const [announce, setAnnounce] = useState<{ id: string; photo: boolean; sheet: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (!announce) {
      return;
    }
    if (announce.photo && !image) {
      return;
    }
    const timer = setTimeout(
      () => {
        // Two frames, which is the earliest anything can honestly claim to have
        // been drawn: one to lay the change out, one to put it on the screen.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            console.log(`HTN-READY ${announce.id}`);
            try {
              const ready = new File(Paths.document, "htn-ready.txt");
              ready.create({ overwrite: true });
              ready.write(announce.id);
            } catch {
              // Then the script falls back to waiting, which is what it did
              // before this existed.
            }
          }),
        );
      },
      announce.sheet ? SHEET_SETTLE : 0,
    );
    return () => clearTimeout(timer);
  }, [announce, image]);

  /**
   * The second way in, and on iOS the only one that works for a capture.
   *
   * `simctl openurl` looks like the obvious route and is not: it hands the URL
   * to SpringBoard, which asks "Open in Hide The Notch?" and leaves that alert
   * sitting over the very screenshot being taken. `simctl` can write into the
   * app's container directly, and a relaunch reads it here. The file is
   * consumed on read, so it acts once, and it is never there in a shipped app.
   */
  useEffect(() => {
    try {
      const asking = new File(Paths.document, "htn-shot.txt");
      if (!asking.exists) {
        return;
      }
      const asked = asking.textSync().trim();
      asking.delete();
      play(asked);
    } catch {
      // A capture aid has no business breaking a launch.
    }
  }, [play]);

  useEffect(() => {
    void Linking.getInitialURL().then(play);
    const sub = Linking.addEventListener("url", (e) => play(e.url));
    return () => sub.remove();
  }, [play]);

  const save = useCallback(async () => {
    setBusy(true);
    const outcome = await saveToPhotos(ctx);
    setBusy(false);
    if (outcome.ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setExportOpen(false);
      Alert.alert(
        t("saved"),
        tp("savedBody", { px: `${outcome.result.widthPx} x ${outcome.result.heightPx} px` }),
      );
    } else if (outcome.reason === "permission") {
      Alert.alert(t("photoDenied"), t("photoDeniedSave"));
    } else {
      Alert.alert(t("exportFailed"), outcome.message ?? t("unknownError"));
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
      report("export.share", e, describeContext(ctx));
      Alert.alert(t("shareFailed"), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [ctx]);

  return (
    <View style={styles.root} onLayout={revealApp}>
      <GestureDetector gesture={canvasGestures}>
        {/* The wallpaper is a control, not a picture: sideways it pages between
            effects. A screen reader gets that page as an adjustable, which is
            the only way to reach the other two effects without a swipe that
            VoiceOver has already taken for itself. What is inside is a drawing
            with nothing to read, so it is announced as one thing. */}
        <View
          style={StyleSheet.absoluteFill}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t("effects")}
          accessibilityValue={{ text: familyLabel(family) }}
          accessibilityActions={ADJUST}
          onAccessibilityAction={(e) => {
            const at =
              FAMILY_ORDER.indexOf(family) + (adjustStep(e.nativeEvent.actionName, 1) || 0);
            commitFamily(Math.min(FAMILY_ORDER.length - 1, Math.max(0, at)));
          }}
        >
          <Animated.View style={[styles.pager, { width: W * FAMILY_ORDER.length }, pagerStyle]}>
            {FAMILY_ORDER.map((f) => (
              <View key={f} style={{ width: W }}>
                {/* In the editor, and under two fingers, only the page being
                    looked at is drawn. A drag changes the source on every
                    frame, and the source is what all four pages share: left
                    alone they would each redraw a full screen per frame to sit
                    still off screen, where the pager cannot go. */}
                {(!(editing || reframing) || f === family) && (
                  <Preview
                    source={source}
                    mask={masks[f]}
                    geometry={geometry}
                    image={image}
                    compare={compare}
                  />
                )}
              </View>
            ))}
          </Animated.View>
          {/* The icons do not travel with the pages: they are the room the
              wallpaper is being judged in, not one of the things on offer.

              It moves rather than fades, which is not a taste: the tiles are
              real glass, and a glass view whose ancestor is part way through a
              fade renders nothing at all. See HomeGrid. */}
          <HomeGrid geometry={geometry} visible={peeking} />
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

      {/* The interface stands aside rather than dissolving: the corner button
          on the left leaves by the left, the sliders and the button on the
          right leave by the right, and the family dots drop out of the bottom.
          Each group is one Sweep, because each one has a different edge to
          leave by and its own width to travel. See src/ui/Sweep.tsx for why it
          is movement and not opacity. */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={peeking || editing ? "none" : "box-none"}
      >
        <Sweep t={asideT} edge="bottom" style={[styles.dots, { bottom: bottom + BUTTON / 2 - 4 }]}>
          <FamilyDots family={family} />
        </Sweep>

        <Sweep t={asideT} edge="right" style={[styles.right, styles.column, { bottom: secondRow }]}>
          {mask.type === "fade" && (
            <CurvePicker
              value={mask.curve as CurveId}
              onChange={(curve) => setMask({ ...mask, curve })}
            />
          )}

          {mask.type === "bar" && (
            <VSlider
              label={t("corner")}
              symbol="square.on.square"
              height={SLIDER_H_SHORT}
              value={mask.corner}
              onChange={(corner) => setMask({ ...mask, corner })}
            />
          )}

          <VSlider
            label={control.label}
            symbol={control.symbol}
            readout={control.readout}
            value={control.value}
            onChange={(v) => setMask(control.apply(v))}
          />
        </Sweep>

        <Sweep t={asideT} edge="left" style={[styles.left, { bottom }]}>
          <CornerButton
            icon="photo"
            label={t("wallpaper")}
            onPress={stopThen(() => setSourceOpen(true))}
          />
        </Sweep>
        <Sweep t={asideT} edge="right" style={[styles.right, { bottom }]}>
          <CornerButton
            icon="export"
            label={t("export")}
            onPress={stopThen(() => setExportOpen(true))}
          />
        </Sweep>
      </View>

      <SourceSheet
        visible={sourceOpen}
        onClose={() => setSourceOpen(false)}
        onPickPhoto={stopThen(() => {
          setPending("photo");
          setSourceOpen(false);
        })}
        // The sheet stays up: picking a gradient and then trying it against
        // each effect is one continuous act, and closing after every tap turns
        // it into three.
        onPickPalette={stopThen((preset: GradientPresetId) => setSource(presetSource(preset)))}
        onEditGradient={stopThen(() => {
          setSourceOpen(false);
          setEditing(true);
        })}
        current={source.type === "photo" ? "photo" : source.preset}
        geometry={geometry}
        mask={mask}
        source={source}
        image={image}
        masks={masks}
        family={family}
        onPickFamily={setFamily}
      />

      <ExportSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        onSave={stopThen(() => void save())}
        onShare={stopThen(() => void share())}
        // Both close the sheet first: the demo opens sheets of its own, and the
        // support sheet cannot be presented while this one is still up.
        onDemo={stopThen(() => {
          setExportOpen(false);
          setPending("demo");
        })}
        onSupport={stopThen(() => {
          setExportOpen(false);
          setPending("support");
        })}
        target={geometry}
        busy={busy}
        compare={compare}
        onCompare={setCompare}
      />

      <SupportSheet
        visible={supportOpen}
        onClose={() => setSupportOpen(false)}
        geometry={detected}
      />

      {demo.running && (
        <>
          {/* The first touch stops the demo, and is spent doing it. Handing the
              app back mid animation and then continuing to move it would be
              worse than one tap. While a sheet is up there is nothing to catch:
              the sheet is above everything and its own rows already stop it. */}
          {!sheetOpen && (
            <View
              style={StyleSheet.absoluteFill}
              onStartShouldSetResponder={() => {
                demo.stop();
                return true;
              }}
            />
          )}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <DemoFinger finger={demo.finger} />
          </View>
        </>
      )}

      {/* Android only, and iOS settled in the Info.plist instead.

          The top of this screen is black by construction, so the bar has to be
          light in both appearances, and the app follows the system now. Those
          two facts do not fit through `expo-status-bar` on iOS: it is React
          Native's `StatusBar`, which calls `RCTStatusBarManager`, which
          `RCTLogError`s the moment `UIViewControllerBasedStatusBarAppearance`
          is YES. That error is what opened every development launch on a red
          screen, and it is a property of *making the call*, not of the key.

          So iOS makes no call at all. The key is NO and `UIStatusBarStyle` is
          `UIStatusBarStyleLightContent`, both static in the Info.plist, which
          is the older mechanism and the only one that states a style without
          asking a view controller that now follows the phone. Android is the
          platform that still has to be told at runtime. */}
      {Platform.OS !== "ios" && <StatusBar style="light" />}
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
  pager: { position: "absolute", top: 0, bottom: 0, left: 0, flexDirection: "row" },
  left: { position: "absolute", left: 16 },
  right: { position: "absolute", right: 16 },
  column: { alignItems: "center", gap: 14 },
  dots: { position: "absolute", left: 0, right: 0, alignItems: "center" },
});
