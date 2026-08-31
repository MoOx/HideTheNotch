import type { ReactNode } from "react";
import { ListItem } from "@expo/ui";

export type RowProps = {
  children: string;
  onPress?: () => void;
  leading?: ReactNode;
  /** A switch, on the rows that are a setting rather than a destination. */
  trailing?: ReactNode;
  supportingText?: ReactNode;
};

/**
 * A row in a sheet.
 *
 * The platform's own list row, which on iOS is `@expo/ui`'s `ListItem` inside a
 * SwiftUI `Form` and needs nothing else. `Row.android.tsx` says what it takes on
 * the other side.
 */
export function Row({ children, onPress, leading, trailing, supportingText }: RowProps) {
  return (
    <ListItem
      onPress={onPress}
      leading={leading}
      trailing={trailing}
      supportingText={supportingText}
    >
      {children}
    </ListItem>
  );
}
