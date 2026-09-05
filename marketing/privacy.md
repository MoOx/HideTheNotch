# Privacy

Hide The Notch has no account, no ads, no analytics, and no tracking. It sends
one thing, to one place, and only when something goes wrong.

This page is the app's privacy policy, and it describes the code rather than an
intention: the app is open source, and every claim below can be checked against
it.

## Your photos never leave your phone

The app opens the system photo picker, which hands it the one image you chose
and nothing else. That image is decoded, drawn and exported entirely on the
device. Nothing about it is uploaded, and no server is involved at any point,
because the app has no server.

A wallpaper you export is written to your photo library, and only when you ask
for it.

## Crash reports, and nothing else

When the app fails, it sends a crash report to [Sentry](https://sentry.io),
which is the only third party that receives anything at all. That report exists
so a bug can be found and fixed, and it is used for nothing else.

**What is in it**: the error and where it happened in the code, the app version
and build, the device model and operating system version, and a random
identifier generated at installation so that several reports from one phone can
be recognised as the same phone.

**What is deliberately not in it**, each turned off in the app's own source:

- Your IP address, and any identifier the operating system gives out.
- Screen recordings. Session replay is off, because the screen is somebody's
  photograph.
- Performance measurements.
- The app's own log messages, which are filtered out before a report is sent
  because they contain file paths.

The installation identifier is not linked to you, is not an advertising
identifier, and is not used to follow you anywhere. Nothing here is sold, and
nothing is shared with anyone else.

Reports are kept by Sentry for as long as that project keeps them, and are
deleted with it.

## What the app asks your phone for

Your photo library, so you can pick a photo and save a wallpaper. On Android it
asks for the narrowest permission that allows a single pick and a single write,
rather than for access to the whole library.

Nothing else is requested. There is no location, no contacts, no microphone use
by the app, and no network access beyond the crash report above.

## Children

The app collects nothing that could identify anybody, of any age, and shows no
advertising.

## Changes

This page changes when the app does. It is generated from the app's own source
and listing, so it cannot drift away from what the app actually does.

## Contact

Questions, or a request about a report the app may have sent:
[apps+hide-the-notch@moox.io](mailto:apps+hide-the-notch@moox.io)
