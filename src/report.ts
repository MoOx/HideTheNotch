import * as Sentry from "@sentry/react-native";

import type { Geometry } from "./geometry/devices";

/**
 * Telling Sentry about a failure the app handled by itself.
 *
 * The three global handlers the SDK installs (uncaught throws, unhandled
 * rejections, native crashes) catch the failures nobody wrote code for. They do
 * not catch the ones somebody did: an export that could not write its file, a
 * photograph that would not decode, a native module answering nonsense. Those
 * end in a `catch` that shows an alert, and an alert is seen by one person who
 * is not going to write about it.
 *
 * Which is the wrong way round. A handled failure is the *more* interesting
 * one: it is a path somebody anticipated, in the part of the app that does the
 * thing the app is for, and it is currently the only kind that leaves no trace
 * at all.
 *
 * `where` is a short, stable name for the site rather than a sentence, so that
 * the same failure groups with itself across versions and languages: it is a
 * tag, and Sentry indexes it.
 */
export function report(where: string, cause: unknown, extra?: Record<string, unknown>) {
  Sentry.captureException(cause instanceof Error ? cause : new Error(String(cause)), {
    tags: { where },
    extra,
  });
}

/**
 * The screen a report came from, which for this app is most of the diagnosis.
 *
 * Everything this app gets wrong, it gets wrong about one screen: how tall the
 * black is, where the hole sits, whether anything was measured at all. So a
 * report is worth having only alongside the four numbers the mask was computed
 * from, and `cutoutFrom` above all: a complaint from a phone that measured its
 * own cutout is a bug in the drawing, and the same complaint from one that fell
 * back to the safe area is a missing row in `models.ts`.
 *
 * None of it identifies anybody. It is the same handful of facts the support
 * sheet already puts in an email, and it is here so that a crash report is as
 * useful as an email from someone who took the trouble to write one.
 */
export function reportGeometry(g: Geometry) {
  Sentry.setContext("screen", {
    label: g.label,
    size: `${g.width} x ${g.height} @${g.scale}x`,
    cutout: g.kind,
    measuredBy: g.cutoutFrom,
    insets: `${g.insetTop} / ${g.insetBottom}`,
  });
  // A tag as well as a context, because this is the one field worth grouping
  // and filtering by, and contexts are searchable but not aggregated.
  Sentry.setTag("cutoutFrom", g.cutoutFrom);
}
