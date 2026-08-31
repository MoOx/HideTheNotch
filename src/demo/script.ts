import type { GradientPresetId, MaskFamily } from "../recipe/types";

/**
 * The demo, as data.
 *
 * A recipe is serialisable and the screen is a function of it, so a
 * demonstration of this app does not need anything to tap: it is a list of
 * changes played into the state the interface writes to anyway. The same list
 * then serves the App Preview video, the store screenshots and the "Demo" row
 * in the export sheet, which is the point: three consumers, one storyboard, no
 * chance of them drifting apart.
 *
 * Durations are relative rather than absolute timestamps. A timeline of
 * absolute times reads better in a document and renumbers itself every time a
 * beat is inserted, which is the wrong trade for something meant to be edited.
 */
export type DemoSheet = "source" | "export" | null;

export type DemoStep =
  /** Nothing changes. Holding still is how a viewer reads what just happened. */
  | { kind: "hold"; ms: number }
  /** The one setting of the current family, driven from where it is to `to`. */
  | { kind: "param"; to: number; ms: number }
  | { kind: "family"; to: MaskFamily; ms: number }
  | { kind: "palette"; to: GradientPresetId; ms: number }
  | { kind: "sheet"; to: DemoSheet; ms: number }
  /** The sketched home screen, which is where the cutout stops existing. */
  | { kind: "peek"; on: boolean; ms: number };

/**
 * Eighteen seconds, inside Apple's 15 to 30 window with room at both ends.
 *
 * The order is the order someone uses the app in: settle on the default, work
 * the setting, glance at the next effect and come straight back, change the
 * colours, look at it on a home screen, export. It ends on the home screen
 * rather than on the editor, because the product is the result and not the
 * interface.
 *
 * One page across and back, rather than a tour of all three families. The
 * gesture is the thing worth showing; that there are three of them is the
 * wallpaper sheet's job, and it says it better, with thumbnails.
 */
export const DEMO: DemoStep[] = [
  { kind: "hold", ms: 1000 },

  // The setting, both ways, so it reads as one continuous control rather than
  // as a button that did something.
  { kind: "param", to: 0.72, ms: 1600 },
  { kind: "hold", ms: 500 },
  { kind: "param", to: 0.3, ms: 1100 },
  { kind: "hold", ms: 400 },

  // Across and straight back. Long enough to see the page move, short enough
  // that it reads as "there is more this way" and not as a second demo.
  { kind: "family", to: "bar", ms: 900 },
  { kind: "hold", ms: 350 },
  { kind: "family", to: "fade", ms: 900 },
  { kind: "hold", ms: 400 },

  { kind: "sheet", to: "source", ms: 800 },
  { kind: "palette", to: "ember", ms: 900 },
  { kind: "palette", to: "moss", ms: 900 },
  { kind: "palette", to: "aurora", ms: 900 },
  { kind: "sheet", to: null, ms: 700 },

  { kind: "peek", on: true, ms: 1500 },
  { kind: "peek", on: false, ms: 700 },

  { kind: "sheet", to: "export", ms: 900 },
  { kind: "hold", ms: 1400 },
  { kind: "sheet", to: null, ms: 700 },

  { kind: "hold", ms: 1500 },
];

/** Total run time. Apple accepts an App Preview between 15 and 30 seconds. */
export const DEMO_MS = DEMO.reduce((total, step) => total + step.ms, 0);
