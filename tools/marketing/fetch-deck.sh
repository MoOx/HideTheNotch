#!/usr/bin/env bash
#
# Brings a deck built by CI down to this machine.
#
# `store-captures.yml` photographs both platforms and composes both decks, and
# leaves all of it as run artefacts. Artefacts do not travel on their own: the
# deck job downloads the captures inside its own run, and outside that run
# nothing does. This is the outside.
#
#   npm run deck:fetch              the latest successful run
#   npm run deck:fetch -- 12345678  a specific run id
#   HTN_WHAT=captures npm run deck:fetch   the raw captures instead of the deck
#
# Then `fastlane ios metadata` or `fastlane android beta` uploads it, reading
# what has just landed in marketing/renders.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORKFLOW="store-captures.yml"
WHAT="${HTN_WHAT:-deck}"

if ! command -v gh >/dev/null 2>&1; then
  echo "This needs the GitHub CLI: brew install gh, then gh auth login."
  exit 1
fi

RUN="${1:-}"
if [ -z "$RUN" ]; then
  echo "==> looking for the last successful $WORKFLOW"
  RUN=$(gh run list --workflow "$WORKFLOW" --status success --limit 1 \
    --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)
fi

if [ -z "$RUN" ] || [ "$RUN" = "null" ]; then
  echo "No successful run of $WORKFLOW to take one from."
  echo
  echo "  Start one by pushing a commit whose message carries [captures], or"
  echo "  from the Actions tab once this branch is the default one."
  echo
  echo "  Or take them here instead, which needs both toolchains:"
  echo "    npm run captures:ios && npm run captures:android && npm run deck"
  exit 1
fi

# What the run says about itself, so that a deck is never composed from a build
# of code nobody can identify. The fingerprint beside the captures answers the
# same question about the interface; this one answers it about the commit.
gh run view "$RUN" --json headSha,createdAt,displayTitle \
  --jq '"==> run \(.createdAt), \(.headSha[0:7]), \(.displayTitle)"'

if [ "$WHAT" = "captures" ]; then
  for platform in ios android; do
    dest="$ROOT/marketing/captures/$platform"
    mkdir -p "$dest"
    gh run download "$RUN" --name "captures-$platform" --dir "$dest"
    echo "==> $platform captures in ${dest#"$ROOT"/}"
  done
  echo
  echo "npm run deck composes both store decks from them."
  exit 0
fi

dest="$ROOT/marketing/renders"
mkdir -p "$dest"
gh run download "$RUN" --name store-deck --dir "$dest"

echo
echo "==> deck in marketing/renders"
find "$dest" -name "*.png" | wc -l | xargs printf "    %s images\n"
echo
echo "Look at them before they go anywhere:"
echo "    npm run marketing:serve"
echo
echo "Then, from this machine:"
echo "    bundle exec fastlane ios metadata"
