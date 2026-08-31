#!/usr/bin/env sh
#
# fastlane, with its gems seen to first.
#
# Every `npm run` that reaches fastlane comes through here, so that a lane is one
# command from a fresh clone rather than one command and a piece of knowledge.
# It is what `npm install` does for JavaScript, applied to the other half of the
# toolchain: v1 did it from `postinstall`, which put a minute of gem installation
# in front of everybody, including everybody who was never going to ship
# anything. This puts it in front of the person who asked to ship.
#
#   tools/fastlane.sh ios beta
#
# `bundle check` is the cheap half: it answers from the lockfile, in
# milliseconds, and is wrong only in the direction that costs nothing (it says
# install when everything is already there, and `bundle install` then does
# nothing).
set -e

cd "$(git rev-parse --show-toplevel)"

if ! command -v bundle >/dev/null 2>&1; then
  echo "No bundler. Ruby is what fastlane runs on:" >&2
  echo "  brew install ruby, then gem install bundler" >&2
  exit 1
fi

if ! bundle check >/dev/null 2>&1; then
  echo "==> installing gems, once, into vendor/bundle"
  # Into the project rather than into the Ruby installation, which is the whole
  # of the analogy with node_modules: nothing outside this directory changes,
  # `rm -rf vendor` undoes it, and a homebrew Ruby whose gem directory is not
  # writable stops being a problem. `ruby/setup-ruby` does the same in CI, with
  # `bundler-cache: true`.
  bundle config set --local path vendor/bundle
  bundle install
fi

# fastlane asks for a UTF-8 locale and it is not being fussy: the listings are
# written in six languages, two of which are not Latin at all, and Ruby reading
# `ja/description.txt` under LC_CTYPE=C turns it into bytes it will not encode
# back. The result is a listing uploaded as mojibake, which nobody reviewing an
# English App Store page would notice.
#
# Only set when absent, so a machine with an opinion keeps it.
if [ -z "${LANG:-}" ] && [ -z "${LC_ALL:-}" ]; then
  LANG=en_US.UTF-8
  LC_ALL=en_US.UTF-8
  export LANG LC_ALL
fi

exec bundle exec fastlane "$@"
