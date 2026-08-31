import { Platform } from "react-native";
import { getLocales } from "expo-localization";

import type { MaskFamily } from "../recipe/types";
import { TABLES, en, type Key, type Locale } from "./strings";

export type { Key, Locale } from "./strings";

/**
 * The language the app speaks, decided once at launch.
 *
 * iOS restarts the app when the language changes, so there is nothing to
 * observe and no reason for this to be a hook: a module constant is the honest
 * shape of a value that cannot change while the code is running.
 */
function resolve(): Locale {
  try {
    const first = getLocales()[0];
    if (!first) {
      return "en";
    }
    const code = (first.languageCode ?? "en").toLowerCase();
    if (code === "zh") {
      // Only simplified is translated. Handing traditional readers simplified
      // would not be a courtesy, so they get the English they can at least
      // expect to be correct.
      return (first.languageTag ?? "").toLowerCase().includes("hant") ? "en" : "zh-Hans";
    }
    return (Object.keys(TABLES) as Locale[]).find((l) => l === code) ?? "en";
  } catch {
    return "en";
  }
}

export const locale: Locale = resolve();

const table = TABLES[locale];

/** One string, with `{name}` placeholders filled in. */
export function t(key: Key, vars?: Record<string, string | number>): string {
  const value: string = table[key] ?? en[key];
  if (!vars) {
    return value;
  }
  return Object.entries(vars).reduce(
    (acc, [name, v]) => acc.split(`{${name}}`).join(String(v)),
    value,
  );
}

/**
 * One string, in the wording that matches the phone in your hand.
 *
 * Only two things the app says depend on the platform, and they are the two
 * that matter most: what to do with the picture once it has been saved. iOS can
 * be told exactly where to go, because there is one Settings app and one
 * Wallpaper screen on every iPhone. Android cannot: every manufacturer moves
 * that screen, renames it, or replaces the picker outright, so the Android
 * wording names no path at all and says the only two things that are true
 * everywhere, set it from your photos and do not let anything crop or zoom it.
 */
export function tp(key: "exportHint" | "savedBody", vars?: Record<string, string | number>) {
  return t(Platform.OS === "ios" ? `${key}Ios` : `${key}Android`, vars);
}

/**
 * The families, named.
 *
 * Kept here rather than next to the type: `src/recipe` is compiled and run
 * outside the app by `npm run verify`, and a native localisation module has no
 * business in that path.
 */
export function familyLabel(family: MaskFamily): string {
  switch (family) {
    case "fade":
      return t("familyFade");
    case "bar":
      return t("familyBar");
    case "stripes":
      return t("familyStripes");
  }
}
