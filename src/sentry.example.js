// @flow

import { Sentry } from "react-native-sentry";

// Sentry.enableInExpoDevelopment = true;

Sentry.config(
  "https://xxx:yyy@sentry.io/zzz"
).install();
