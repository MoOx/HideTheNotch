// @flow

import { Sentry } from "react-native-sentry";

if (process.env.NODE_ENV === "production") {
  Sentry.config("https://xxx:yyy@sentry.io/zzz").install();
}

export default Sentry;
