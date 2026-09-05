#!/usr/bin/env bash
#
# One image per deck, small enough to post and large enough to judge.
#
#   tools/marketing/contact-sheet.sh                  every deck in marketing/renders
#   tools/marketing/contact-sheet.sh build/sheets     somewhere else
#
# Output: <out>/preview-<deck>.jpg, one row per locale, one column per shot.
#
# This exists because a deck cannot be previewed as it is. It is ninety images
# and a hundred and ninety megabytes, and GitHub will only render an image in a
# comment from a public URL, which a run artefact is not: it is a zip behind a
# token. So the thing that gets posted is a contact sheet, and the deck itself
# stays where it was, in the artefact.
#
# Every locale is in it, which is the whole point. A capture run can fail in one
# language and nowhere else, an emulator can hand back a black screen for one
# shot, and a sheet of English alone would say the run was fine.
#
# **These are JPEG, and that is not a contradiction.** The rule that exports are
# never JPEG is about the wallpaper, where block artefacts at the black to image
# boundary are exactly what makes a cutout reappear. Nothing here is exported,
# looked at on a phone, or set as a wallpaper: this is a picture of a picture,
# for deciding whether a capture run worked. As PNG the same sheet is ten
# megabytes rather than six hundred kilobytes, because the app dithers its
# gradients on purpose and dithering is what PNG compresses worst. Judge the
# black in the deck itself, never here.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RENDERS="${HTN_RENDERS:-$ROOT/marketing/renders}"
OUT="${1:-$ROOT/build/sheets}"
# Wide enough to read a headline at full size, small enough that three of these
# are a couple of megabytes.
TILE="${HTN_TILE:-240}"
QUALITY="${HTN_QUALITY:-88}"

# ImageMagick 7 renamed the entry point and deprecated the old one, and both are
# in the wild: `magick` on a current install, `montage` on an older one.
if command -v magick >/dev/null 2>&1; then
  IM() { magick "$@"; }
  IM_MONTAGE() { magick montage "$@"; }
elif command -v montage >/dev/null 2>&1; then
  IM() { convert "$@"; }
  IM_MONTAGE() { montage "$@"; }
else
  echo "This needs ImageMagick: brew install imagemagick, or apt install imagemagick."
  exit 1
fi

# A font by file rather than by name, because the name a build knows depends on
# how it was compiled and a missing one fails the row rather than the label.
FONT=""
for candidate in \
  /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf \
  /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf \
  /System/Library/Fonts/Supplemental/Arial.ttf \
  /System/Library/Fonts/Helvetica.ttc
do
  [ -f "$candidate" ] && { FONT="$candidate"; break; }
done
if [ -z "$FONT" ]; then
  echo "!! no font found, the rows will not be labelled" >&2
fi

if [ ! -d "$RENDERS" ]; then
  echo "No deck at $RENDERS."
  echo "  npm run deck        composes it from the captures"
  echo "  npm run deck:fetch  brings one down from a CI run"
  exit 1
fi

mkdir -p "$OUT"
made=0

for deck in "$RENDERS"/*/; do
  [ -d "$deck" ] || continue
  name="$(basename "$deck")"
  rows="$(mktemp -d)"
  trap 'rm -rf "$rows"' EXIT

  n=0
  # Sorted, so the rows are in the same order in every sheet and in every run:
  # a reader learns the order once rather than reading six labels every time.
  for locale in $(ls "$deck" | sort); do
    [ -d "$deck/$locale" ] || continue
    shots=$(find "$deck/$locale" -name '*.png' | wc -l | tr -d ' ')
    [ "$shots" -gt 0 ] || continue
    # shellcheck disable=SC2086
    IM_MONTAGE "$deck/$locale"/*.png \
      -tile "${shots}x1" -geometry "${TILE}x+6+6" \
      -background '#111318' -fill '#e6e8ee' \
      ${FONT:+-font "$FONT"} -pointsize 22 -title "$locale" \
      "$rows/$(printf '%02d' "$n")-$locale.png"
    n=$((n + 1))
  done

  if [ "$n" -eq 0 ]; then
    echo "  $name: nothing to draw"
    rm -rf "$rows"
    continue
  fi

  IM "$rows"/*.png -append -background '#111318' -quality "$QUALITY" \
    "$OUT/preview-$name.jpg"
  echo "  $name: $n locales, $(du -h "$OUT/preview-$name.jpg" | cut -f1)"
  made=$((made + 1))
  rm -rf "$rows"
done

if [ "$made" -eq 0 ]; then
  echo "No deck had anything in it under $RENDERS."
  exit 1
fi

echo
echo "Sheets in $OUT:"
ls -1 "$OUT"
