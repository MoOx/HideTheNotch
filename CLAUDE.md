# Conventions

## Writing rules

**Everything written to a file is in English.** Documentation, README files,
code comments, CLI output, commit messages, PR titles and bodies. No exceptions.
Conversation with the user may be in French; files may not.

**Never use em dashes (`—`) or en dashes (`–`).** Use a comma, a colon,
parentheses, or a separate sentence instead. This applies everywhere: docs,
comments, commit messages, and chat replies.

These two rules are project-agnostic. Copy this file to any other repository
where the same conventions should apply.

## Repository specifics

An Expo app that generates wallpapers hiding the notch, the Dynamic Island or a
punch hole. It replaces the 2017 React Native version, which stays in git
history.

The two properties everything rests on, and that no change may break:

- **Black under the cutout is absolute `#000000`.** On OLED a black pixel is an
  off pixel, so it is optically identical to the panel around the camera.
  `#010101` shows in a dark room. Exports are PNG: JPEG produces block artefacts
  at the black to image boundary, which makes the cutout reappear.
- **Preview and export share one drawing path.** `src/render/draw.ts` draws in
  points; the preview plays it at scale 1, the export applies
  `canvas.scale(density)`. Never add a second path.

Before pushing anything that touches rendering:

```sh
npm run typecheck
npm run verify     # checks the two properties above on real pixels
```

`npm run verify` runs the real rendering code against CanvasKit, out of the app,
so it catches a regression without a device. It is also the first job in CI.

Signing material lives in the private `MoOx/certificates` repository, never
here. `fastlane/` and `.github/workflows/ios-testflight.yml` come from its
templates: prefer fixing them upstream over diverging locally.
