#!/usr/bin/env bash
#
# One screenshot that can be trusted.
#
# Sourced, never run. The caller defines `take <file>`, which writes a PNG, and
# calls `steady_shot <file>`.
#
# Two things went wrong often enough to be worth a hundred milliseconds each
# time. A shot taken while the app was still coming up is black, and a shot
# taken while a sheet is still rising is a rectangle halfway up the screen. Both
# are invisible in the terminal: the run says it captured everything, and the
# deck is built out of it.
#
# So every shot is taken twice, a third of a second apart. If the two are
# identical the screen was still, which is the only definition of "the animation
# is over" that does not need either platform to say so. And a shot below a
# floor of bytes is a black one: a PNG of a dark but real screen is seven
# hundred kilobytes and up, a PNG of nothing at all is under a hundred and
# fifty, and there is nothing in between to be wrong about.
#
#   HTN_MIN_BYTES=0 skips the black check, HTN_TRIES how many attempts.

MIN_BYTES="${HTN_MIN_BYTES:-150000}"
TRIES="${HTN_TRIES:-3}"

steady_shot() {
  local dest="$1" probe="$1.probe" n=0 size
  while :; do
    take "$dest"
    sleep 0.3
    take "$probe"
    size=$(wc -c < "$dest" | tr -d ' ')
    if cmp -s "$dest" "$probe" && [ "$size" -ge "$MIN_BYTES" ]; then
      rm -f "$probe"
      return 0
    fi
    n=$((n + 1))
    if [ "$n" -ge "$TRIES" ]; then
      rm -f "$probe"
      if [ "$size" -lt "$MIN_BYTES" ]; then
        printf '    ! still black after %s tries (%s bytes)\n' "$n" "$size" >&2
      else
        printf '    ! still moving after %s tries\n' "$n" >&2
      fi
      return 0
    fi
    printf '    retaking (%s)\n' "$([ "$size" -lt "$MIN_BYTES" ] && echo black || echo moving)"
    sleep 0.7
  done
}
