import type { ReactNode } from "react";

/**
 * The second line of a row, everywhere iOS is not.
 *
 * `.tsx` and not `.ts`, even with no JSX in it, because Metro resolves a
 * platform split extension first and source extension second: with a
 * `supporting.ts` next to a `supporting.ios.tsx`, the plain `.ts` wins on every
 * platform and the iOS file is never bundled. That is exactly what happened,
 * and what `ColorControl` avoids by having both halves in `.tsx`.
 *
 * Material's `ListItem` styles its own supporting slot, so the string is handed
 * back untouched and the platform decides. iOS resolves `supporting.ios.tsx`
 * instead, where it does not.
 */
export function supporting(text: string): ReactNode {
  return text;
}
