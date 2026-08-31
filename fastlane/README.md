fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

### doctor

```sh
[bundle exec] fastlane doctor
```

Report what the environment holds and which lane wants what

----


## iOS

### ios beta

```sh
[bundle exec] fastlane ios beta
```

Build the app and ship it to TestFlight

### ios metadata

```sh
[bundle exec] fastlane ios metadata
```

Push the store listing, without building anything

### ios release

```sh
[bundle exec] fastlane ios release
```

Take the last TestFlight build to the App Store record, ready to submit

### ios certificates

```sh
[bundle exec] fastlane ios certificates
```

Create or renew the certificates and profiles (local only)

----


## Android

### android bundle

```sh
[bundle exec] fastlane android bundle
```

Build a signed AAB and stop, for the one upload Google wants by hand

### android beta

```sh
[bundle exec] fastlane android beta
```

Build the AAB and ship it to the Google Play internal track

### android release

```sh
[bundle exec] fastlane android release
```

Promote the last internal build to production

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
