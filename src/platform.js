// @flow

import { Platform, Dimensions } from "react-native";

// taken from https://github.com/react-community/react-navigation/blob/master/src/views/SafeAreaView.js
// See https://mydevice.io/devices/ for device dimensions
const X_WIDTH = 375;
const X_HEIGHT = 812;

export const { height: windowHeight, width: windowWidth } = Dimensions.get(
  "window"
);

export const isIPhoneX =
  Platform.OS === "ios" &&
  ((windowHeight === X_HEIGHT && windowWidth === X_WIDTH) ||
    (windowHeight === X_WIDTH && windowWidth === X_HEIGHT));

export const hasNotch = isIPhoneX;
export const hasInsetBottom = isIPhoneX;
export const notchDiff = 44 - 20;
