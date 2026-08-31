import type { ReactNode } from "react";
import { Text } from "@expo/ui/swift-ui";
import { font, foregroundStyle, opacity } from "@expo/ui/swift-ui/modifiers";

/**
 * The second line of a row, at the size iOS actually gives one.
 *
 * `ListItem` handed a plain string only recolours it on iOS: the size stays at
 * body, so the row comes out as two headlines and the hierarchy it was there to
 * carry is gone. Its own documentation points the way out, which is to pass a
 * node rather than a string.
 *
 * `.footnote` rather than a size in points, so the line still follows Dynamic
 * Type, and `secondaryLabel` rather than a grey of our own, which is what
 * `ListItem` was applying and the one part of it that was right.
 *
 * Split by file rather than branched in the body because `@expo/ui/swift-ui`
 * asks for its native view at import time, exactly like `ColorControl`: on
 * Android a `Platform.OS` check would already be too late. Everywhere else,
 * `supporting.ts` hands the string straight back, since Material's own list
 * item already styles its supporting slot.
 */
export function supporting(text: string): ReactNode {
  return (
    <Text
      modifiers={[
        font({ textStyle: "footnote" }),
        foregroundStyle({ type: "color", color: "secondaryLabel" }),
        // Secondary is the system's own answer and it is still quite present.
        // A supporting line is read after the one above it or not at all, so
        // it can afford to sit further back than the system dares to put it.
        opacity(0.72),
      ]}
    >
      {text}
    </Text>
  );
}
