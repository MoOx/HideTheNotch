import { registerRootComponent } from "expo";
import * as SplashScreen from "expo-splash-screen";
import * as Sentry from "@sentry/react-native";

import App from "./App";

/**
 * Crash reporting, and deliberately nothing else.
 *
 * The app is free, it has no account, and it opens the photo library. So the
 * question is not what Sentry can collect, it is what this app has any business
 * sending, and the answer is: the fact that it broke, and where in the code.
 *
 * **What is on.** Unhandled JavaScript errors, the ones that would otherwise
 * show a red screen in development and do nothing visible in production;
 * unhandled promise rejections, which is the shape most failures here would
 * take since export, sharing and photo decoding are all async and an
 * un-awaited `void somePromise()` swallows its own error; and native crashes,
 * caught by sentry-cocoa and sentry-android below the JavaScript engine, which
 * is the only channel that can report a Skia or a Kotlin fault at all, since
 * the process is gone before any JavaScript could run.
 *
 * **What is off, and why.** Session replay records the screen: the screen is
 * somebody's photograph. Performance tracing measures an app with no network
 * and one screen, so it would cost battery to learn nothing. `sendDefaultPii`
 * attaches the device's own identifiers and the user's IP. Console breadcrumbs
 * carry whatever was logged, and what this app logs is file URIs.
 *
 * Everything off here is also a line that would have to be declared in App
 * Privacy and in Data safety, and defended in the privacy policy. Off is
 * cheaper, in every sense.
 */
Sentry.init({
  // Public by design: it names where reports go and grants nothing.
  dsn: "https://23cae301c46e40879003d4e578f0155f@o109907.ingest.us.sentry.io/241860",

  // Which build a report came from, in the two fields Sentry indexes by. The
  // commit is stamped by the release lane (`stamp_commit!` in the Fastfile), so
  // a stack trace points at a state of the repository rather than at a version
  // number that a dozen builds share.
  dist: process.env.EXPO_PUBLIC_COMMIT,

  // Crashes only. See above for each of these.
  tracesSampleRate: 0,
  enableAutoPerformanceTracing: false,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  sendDefaultPii: false,

  enableCaptureFailedRequests: false,

  /**
   * A trail of what happened before the crash, minus what the app printed.
   *
   * Console breadcrumbs are the ones worth refusing: this app logs file URIs,
   * and a file URI carries the container's identifier on iOS and can carry a
   * photograph's name on Android. What is left is the interaction trail, which
   * says what was touched without saying what was in it.
   */
  beforeBreadcrumb(breadcrumb) {
    return breadcrumb.category === "console" ? null : (scrub(breadcrumb) as typeof breadcrumb);
  },

  /**
   * The last gate, on the way out.
   *
   * Nothing above is expected to put a path in an event, and a path is exactly
   * what this app's error messages are made of: `useSourceImage` reports the
   * URIs it tried, and the export failure alert carries whatever the file
   * system said. So the whole event is walked and anything shaped like a file
   * URI is replaced by its scheme.
   *
   * It runs on every event rather than on the fields known to be risky today,
   * because the next message someone writes will not know about this.
   */
  beforeSend(event) {
    return scrub(event) as typeof event;
  },
});

/** Replaces file URIs and absolute paths, anywhere in an event. */
function scrub(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/file:\/\/\S+/g, "file://<path>")
      .replace(/\/(?:var|data|storage|Users)\/\S+/g, "<path>");
  }
  if (Array.isArray(value)) {
    return value.map(scrub);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrub(v)]));
  }
  return value;
}

// The system would otherwise pull the launch image the moment the root view
// appears, which is before anything has been painted into it. The app hides it
// itself, one frame after its first layout, and the system cross fades it out.
//
// That fade is the whole transition, and it is enough because the launch image
// is the app's own aurora gradient drawn by the same code: the gradient stays
// where it is, and what changes across the fade is the black arriving at the
// top, the marks going, and the controls sliding in from the edges.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 450, fade: true });

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
//
// Wrapped, which is what puts a React error boundary above the whole tree: a
// render that throws is otherwise a white screen and no report.
registerRootComponent(Sentry.wrap(App));
