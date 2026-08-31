import { ListItem, Text, useMaterialColors } from "@expo/ui/jetpack-compose";
import { clickable } from "@expo/ui/jetpack-compose/modifiers";

import type { RowProps } from "./Row";

/**
 * The same row, minus one surface.
 *
 * `FieldGroup.Section` on Android already wraps each of its children in a
 * Material `ListItem` filled with `surfaceContainer`, which is what draws the
 * rounded grey card of a Material 3 connected list. `@expo/ui`'s own `ListItem`
 * inside that one then fills itself with `surface`, the darkest role in the
 * scheme, so every row came out as a black rectangle floating in a grey card:
 * two surfaces where the design has one.
 *
 * Same component, same slots, one colour: the row takes the container's own
 * fill, and the card is the only surface again.
 */
export function Row({ children, onPress, leading, trailing, supportingText }: RowProps) {
  const colors = useMaterialColors();

  return (
    <ListItem
      colors={{ containerColor: colors.surfaceContainer }}
      modifiers={onPress ? [clickable(onPress)] : undefined}
    >
      <ListItem.HeadlineContent>
        <Text>{children}</Text>
      </ListItem.HeadlineContent>
      {supportingText != null ? (
        <ListItem.SupportingContent>
          {typeof supportingText === "string" ? <Text>{supportingText}</Text> : supportingText}
        </ListItem.SupportingContent>
      ) : null}
      {leading != null ? <ListItem.LeadingContent>{leading}</ListItem.LeadingContent> : null}
      {trailing != null ? <ListItem.TrailingContent>{trailing}</ListItem.TrailingContent> : null}
    </ListItem>
  );
}
