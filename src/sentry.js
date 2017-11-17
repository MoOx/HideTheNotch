// @flow

import { Sentry } from "react-native-sentry";

// Sentry.enableInExpoDevelopment = true;

Sentry.config(
  "set your own token here - check sentry website"
).install();
