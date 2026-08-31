import { ISLAND, NOTCH_NARROW, NOTCH_WIDE, type Cutout, type CutoutKind } from "./devices";

/**
 * Which iPhone has which hole, by hardware identifier.
 *
 * The safe area alone keeps a mask *safe*: a cutout is inside it by
 * construction, so black that reaches the safe area line always covers the
 * hole. What the safe area cannot do is say what the hole looks like, and this
 * app draws it: the preview puts the real shape on the real wallpaper, which is
 * the whole reason anyone trusts the result before setting it.
 *
 * iOS publishes no shape at all, so on iOS it is a table. There are few enough
 * iPhones for that to be a table rather than a database, and the identifier is
 * exact where a measurement is not: the top inset says 47 pt for both the wide
 * notch of an iPhone 12 and the narrow one of an iPhone 13, which are 48 pt
 * apart in width. The iPhone 16e is the sharpest case: a 2025 phone with a
 * notch, on a chassis whose neighbours all have an island.
 *
 * **Anything not in this table falls back to the safe area** (`inferCutout`),
 * which is why a phone released after this file was written is a slightly
 * rougher drawing rather than a bug.
 */
type Family = { kind: CutoutKind; box: { w: number; h: number; y: number; r: number } };

const ISLAND_FAMILY: Family = { kind: "island", box: ISLAND };
const WIDE: Family = { kind: "notch", box: NOTCH_WIDE };
const NARROW: Family = { kind: "notch", box: NOTCH_NARROW };

/**
 * iPhone X through 12 Pro Max: the original 209 pt notch.
 * iPhone 13 through 14 Plus, and the 16e: the same notch, narrowed to 161 pt.
 * iPhone 14 Pro onwards: the Dynamic Island, identical on every one of them.
 */
const MODELS: Record<string, Family> = {};

for (const id of [
  "iPhone10,3", // X
  "iPhone10,6", // X, GSM
  "iPhone11,2", // XS
  "iPhone11,4", // XS Max
  "iPhone11,6", // XS Max, China
  "iPhone11,8", // XR
  "iPhone12,1", // 11
  "iPhone12,3", // 11 Pro
  "iPhone12,5", // 11 Pro Max
  "iPhone13,1", // 12 mini
  "iPhone13,2", // 12
  "iPhone13,3", // 12 Pro
  "iPhone13,4", // 12 Pro Max
]) {
  MODELS[id] = WIDE;
}

for (const id of [
  "iPhone14,2", // 13 Pro
  "iPhone14,3", // 13 Pro Max
  "iPhone14,4", // 13 mini
  "iPhone14,5", // 13
  "iPhone14,7", // 14
  "iPhone14,8", // 14 Plus
  "iPhone17,5", // 16e
]) {
  MODELS[id] = NARROW;
}

for (const id of [
  "iPhone15,2", // 14 Pro
  "iPhone15,3", // 14 Pro Max
  "iPhone15,4", // 15
  "iPhone15,5", // 15 Plus
  "iPhone16,1", // 15 Pro
  "iPhone16,2", // 15 Pro Max
  "iPhone17,1", // 16 Pro
  "iPhone17,2", // 16 Pro Max
  "iPhone17,3", // 16
  "iPhone17,4", // 16 Plus
  // The 17 generation. Listing it buys exactness rather than correctness: every
  // one of them has the island, and an island is also what the safe area falls
  // back to at 59 pt, so a wrong number here costs nothing.
  "iPhone18,1", // 17 Pro
  "iPhone18,2", // 17 Pro Max
  "iPhone18,3", // 17
  "iPhone18,4", // Air
]) {
  MODELS[id] = ISLAND_FAMILY;
}

/**
 * The cutout of a known iPhone, or `null` for anything else.
 *
 * `null` covers three things that all want the same answer: a phone with no
 * cutout, a phone newer than this table, and Android.
 */
export function cutoutForModel(
  modelId: string | null | undefined,
  width: number,
): { kind: CutoutKind; cutout: Cutout } | null {
  const family = modelId ? MODELS[modelId] : undefined;
  if (!family) {
    return null;
  }
  const { box } = family;
  return {
    kind: family.kind,
    cutout: { x: (width - box.w) / 2, y: box.y, w: box.w, h: box.h, r: box.r },
  };
}
