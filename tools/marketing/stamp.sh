# Skip work whose inputs have not changed. Sourced, not run.
#
# `changed <name> <file...>` is true when those files differ from the last
# successful `keep <name>`. The new value is only promoted by `keep`, so a step
# that fails leaves the old stamp alone and runs again next time, which is the
# behaviour you want from a cache you are not going to think about.
STAMP_DIR="${STAMP_DIR:-build/.stamps}"

changed() {
  name=$1
  shift
  mkdir -p "$STAMP_DIR"
  now=$(cat "$@" 2>/dev/null | shasum -a 256 | cut -d' ' -f1)
  was=""
  [ -f "$STAMP_DIR/$name" ] && was=$(cat "$STAMP_DIR/$name")
  printf '%s' "$now" > "$STAMP_DIR/$name.pending"
  [ "$now" != "$was" ]
}

keep() {
  [ -f "$STAMP_DIR/$1.pending" ] && mv "$STAMP_DIR/$1.pending" "$STAMP_DIR/$1"
  return 0
}
