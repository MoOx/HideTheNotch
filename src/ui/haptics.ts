import * as Haptics from "expo-haptics";

/**
 * The taps the app gives back, and the one place their failure is ignored.
 *
 * Every other promise in the app ends in a catch that reports it (see
 * `fail()` and `report()` in src/report.ts), and the lint refuses one that
 * does not. A haptic is the exception, and the only one: a phone without a
 * Taptic Engine, or with system haptics off, is a phone that does not buzz,
 * and there is nobody to tell and nothing to fix. So the failure is swallowed
 * here, once, rather than excused with `void` at every call site.
 */
const quiet = (p: Promise<void>) => {
  p.catch(() => {});
};

/** A detent crossed, or a choice changed. */
export const tick = () => quiet(Haptics.selectionAsync());

/** Something added or taken away under the finger. */
export const bump = (style: Haptics.ImpactFeedbackStyle) => quiet(Haptics.impactAsync(style));

/** The work is done. */
export const success = () =>
  quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

export { ImpactFeedbackStyle } from "expo-haptics";
