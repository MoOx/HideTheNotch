The press kit for this app, assembled by tools/marketing/press-kit.cjs and
force pushed here by .github/workflows/store-captures.yml.

`index.json` is an ordered list of blocks. Each has an image per platform and,
per language, a headline, a subtitle and, in English, a paragraph. Beside them
it points at the two files that hold the rest: marketing/listing.json and
marketing/privacy.md, on the source branch.

The images are the raw captures, web sized, not the composed deck. moox.io
reads this at build time; nothing merges this branch.
