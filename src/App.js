// @flow

import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  View,
  ImageBackground,
  Image,
  StatusBar,
  TouchableOpacity,
  CameraRoll,
  Button,
  Share,
  Linking,
  TouchableHighlight
} from "react-native";

import LinearGradient from "react-native-linear-gradient";
import { captureRef, releaseCapture } from "react-native-view-shot";
import Permissions from "react-native-permissions";
import Feather from "react-native-vector-icons/Feather";

import "./sentry.js";
import effectsList from "../assets/effects";
import type { EffectStyleArguments } from "../assets/effects";
import imagesList from "../assets/wallpapers";
import { windowHeight, windowWidth, hasInsetBottom } from "./platform.js";

const ImagePicker = require("react-native-image-picker");

const getRandomImage = () =>
  imagesList[Math.floor(Math.random() * imagesList.length)];

const widthCoeff = 4;
const previewsMargin = 6;
const previewMargin = 2;
const previewWidth = windowWidth / widthCoeff - previewMargin * 4;

type Effect = Array<{
  file: ImageFile,
  resizeMode: "cover" | "contain",
  style: EffectStyleArguments => Object
}>;

type ImageFile =
  | number
  | {
      uri: string,
      width: number,
      height: number
    };

type ImageType = {
  url?: string,
  author?: string,
  location?: string,
  source?: string,
  file: ImageFile
};

type PropsType = {
  preview?: boolean,
  loader?: boolean,
  image: ImageType,
  effects: Array<Effect>,
  style?: number,
  width: number,
  height: number
};

type StateType = {
  effects: Array<Effect>,
  image: ImageType,
  help: boolean,
  edit: boolean,
  error?: Object,
  saved?: string,
  cameraRoll?: boolean
};

class Wallpaper extends React.Component<PropsType, void> {
  render() {
    const {
      preview,
      loader,
      image,
      effects,
      style,
      width,
      height,
      ...props
    } = this.props;
    return (
      <View
        style={[styles.wallpaper, preview && styles.wallpaperPreview, style]}
        {...props}
      >
        {loader && <ActivityIndicator size="large" />}
        <ImageBackground style={styles.image} source={image.file} />
        {effects.map((effect, i) =>
          effect.map(imageEffect => {
            const imageEffectSource = Image.resolveAssetSource(
              imageEffect.file
            );
            return (
              <Image
                key={i}
                source={imageEffect.file}
                style={[
                  styles.imageEffect,
                  imageEffect.style({
                    width,
                    height,
                    imageWidth: imageEffectSource && imageEffectSource.width,
                    imageHeight: imageEffectSource && imageEffectSource.height
                  })
                ]}
                resizeMode={imageEffect.resizeMode}
              />
            );
          })
        )}
      </View>
    );
  }
}

export default class App extends React.Component<void, StateType> {
  state = {
    effects: [effectsList["Rounded Notch"]],
    image: imagesList[0],
    // help: process.env.NODE_ENV !== "production",
    help: false,
    // edit: process.env.NODE_ENV !== "production"
    edit: false
  };

  _wallpaperView: any;
  saveWallpaperRef = (ref: any) => {
    this._wallpaperView = ref;
  };

  getCameraPermission = async () => {
    try {
      const { status } = await Permissions.askAsync(Permissions.CAMERA);
      if (status == "granted") {
        return true;
      }
    } catch (error) {
      this.setState({ error });
    }
    alert("Camera permissions required. Please adjust this app settings");
    return false;
  };

  generateWallpaper = async () => {
    return await captureRef(this._wallpaperView, {
      width: windowWidth,
      height: windowHeight,
      // format: "png",
      // quality: 1.0,
      result: "tmpfile" // 'tmpfile' 'base64' 'data-uri'
    });
  };

  handleCameraPress = () => {
    this.setState({ cameraRoll: true });
    ImagePicker.launchImageLibrary(
      {
        mediaType: "photo"
      },
      imageFromLib => {
        if (!imageFromLib.didCancel) {
          this.setState({
            image: {
              file: imageFromLib
            }
          });
        }
        this.setState({ cameraRoll: false });
      }
    );
  };

  handleShufflePress = () => {
    let image = getRandomImage();
    while (image === this.state.image) {
      image = getRandomImage();
    }
    this.setState({ image });
  };

  handleHelpPress = () => {
    this.setState(prevState => ({ help: !prevState.help }));
  };

  handleEditPress = () => {
    this.setState(prevState => ({ edit: !prevState.edit }));
  };

  handleSharePress = async () => {
    const newWallpaper = await this.generateWallpaper();
    // this.setState({ log: newWallpaper });
    const result = await Share.share(
      {
        // title: "",
        // message: "",
        url: newWallpaper
      },
      {
        excludedActivityTypes: [
          // https://developer.apple.com/documentation/uikit/uiactivitytype
          "com.apple.UIKit.activity.AddToReadingList",
          // "com.apple.UIKit.activity.AirDrop",
          "com.apple.UIKit.activity.AssignToContact",
          // "com.apple.UIKit.activity.CopyToPasteboard",
          // "com.apple.UIKit.activity.Mail",
          // "com.apple.UIKit.activity.Message",
          "com.apple.UIKit.activity.OpenInIBooks",
          // "com.apple.UIKit.activity.PostToFacebook",
          // "com.apple.UIKit.activity.PostToFlickr",
          // "com.apple.UIKit.activity.PostToTencentWeibo",
          // "com.apple.UIKit.activity.PostToTwitter",
          // "com.apple.UIKit.activity.PostToVimeo",
          // "com.apple.UIKit.activity.PostToWeibo",
          "com.apple.UIKit.activity.Print",
          // "com.apple.UIKit.activity.SaveToCameraRoll",
          "com.apple.UIKit.activity.MarkupAsPDF",
          "com.apple.mobilenotes.SharingExtension"
        ]
      }
    );
    // this.setState({ log: result });
    if (result.action === Share.sharedAction) {
      this.savedFeedback(result.activityType);
    }
    releaseCapture(newWallpaper);
  };

  savedFeedback = (type: string) => {
    this.setState({ saved: type });
    setTimeout(
      () =>
        this.setState({
          // log: undefined,
          saved: undefined
        }),
      3000
    );
  };

  // handleExportPress = async () => {
  //   if (await this.getCameraPermission()) {
  //     const newWallpaper = await this.generateWallpaper();
  //     this.setState({ log: newWallpaper });
  //     try {
  //       await CameraRoll.saveToCameraRoll(newWallpaper);
  //       this.savedFeedback()
  //     } catch (error) {
  //       this.setState({ error });
  //     }
  //   }
  // };

  render() {
    const { state } = this;

    const color = "#fff";
    const invertedColor = "#111";
    return (
      <View style={styles.container}>
        <StatusBar
          animated
          barStyle={
            state.cameraRoll
              ? "default"
              : state.effects.length > 0 ? "light-content" : "default"
          }
        />
        <Wallpaper
          loader
          image={state.image}
          effects={state.effects}
          ref={this.saveWallpaperRef}
          width={windowWidth}
          height={windowHeight}
        />
        <View style={[styles.centerBlock, styles.shadow]}>
          {typeof state.saved != "undefined" &&
            Boolean(state.saved) && (
              <View style={styles.center}>
                <Feather name="check" size={128} color={color} />
                {state.saved ===
                  "com.apple.UIKit.activity.SaveToCameraRoll" && (
                  <Text style={[styles.toolbarText]}>
                    Saved to your camera roll
                  </Text>
                )}
              </View>
            )}
        </View>
        <View style={styles.toolbarWrapper}>
          {/* {process.env.NODE_ENV !== "production" && (
            <View style={[styles.toolbar, { opacity: 0.5 }]}>
              <Text style={[styles.debugText]}>
                Debug: {JSON.stringify(Constants.platform.ios)}
              </Text>
              {state.error && (
                <Text style={[styles.debugText]}>{state.error.toString()}</Text>
              )}
              {state.log && (
                <Text style={[styles.debugText]}>
                  {JSON.stringify(state.log, null, 2)}
                </Text>
              )}
            </View>
          )} */}
          {state.help && (
            <View>
              <View
                style={[styles.toolbar, styles.toolbarBlack, styles.credits]}
              >
                {(state.image.author || state.image.url) && (
                  <Text style={styles.toolbarText}>
                    <Feather
                      name="info"
                      size={16}
                      color={"rgba(255,255,255, 0.4)"}
                    />{" "}
                    Image {state.image.author && "by " + state.image.author}{" "}
                    {state.image.source && "from " + state.image.source}
                  </Text>
                )}
                {state.image.location && (
                  <Text style={styles.toolbarText}>
                    <Feather
                      name="map-pin"
                      size={16}
                      color={"rgba(255,255,255, 0.4)"}
                    />{" "}
                    {state.image.location}
                  </Text>
                )}
              </View>
              <View style={[styles.toolbar, styles.toolbarBlack]}>
                <Text style={styles.helpText}>
                  1. <Feather name="camera" size={16} color={color} /> Choose
                  your photo or{" "}
                  <Feather name="refresh-cw" size={16} color={color} /> randomly
                  pick one
                </Text>
                <Text style={styles.helpText}>
                  2. <Feather name="sliders" size={16} color={color} /> Choose
                  your effect
                </Text>
                <Text style={styles.helpText}>
                  3. <Feather name="share" size={16} color={color} /> Export the
                  picture where you want to use it. You can save it{" "}
                  <Feather name="download" size={16} color={color} /> to your
                  camera roll, then quit the app and set the saved picture as
                  your wallpaper (as you normally do). Be sure to use make it
                  "Still" and align it at the bottom.
                </Text>
              </View>
              <View style={[styles.toolbar, styles.toolbarBlack]}>
                <TouchableHighlight
                  onPress={() =>
                    Linking.openURL("https://moox.io/apps/hide-the-notch")
                  }
                >
                  <Text style={styles.helpText}>
                    Website: https://moox.io/apps/hide-the-notch
                  </Text>
                </TouchableHighlight>
                <TouchableHighlight
                  onPress={() =>
                    Linking.openURL(
                      "mailto:apps+hide-the-notch@moox.io?subject=Support+request"
                    )
                  }
                >
                  <Text style={styles.helpText}>
                    Support email: apps+hide-the-notch@moox.io
                  </Text>
                </TouchableHighlight>
              </View>
            </View>
          )}
          {state.edit && (
            <View
              style={[
                styles.toolbar,
                styles.toolbarInline,
                styles.toolbarBlack
              ]}
            >
              {Object.keys(effectsList).map(key => {
                const effect = effectsList[key];
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() =>
                      !state.effects.includes(effect)
                        ? this.setState({
                            // effects: [...state.effects, effect]
                            effects: [effect]
                          })
                        : this.setState({
                            effects: state.effects.filter(e => e != effect)
                          })
                    }
                    style={[
                      styles.maskButton,
                      state.effects.includes(effect) && styles.maskButtonActive
                    ]}
                  >
                    <View style={styles.maskButtonImageWrapper}>
                      <View style={styles.maskButtonImage}>
                        <Wallpaper
                          preview
                          image={state.image}
                          effects={[effect]}
                          width={previewWidth}
                          height={previewWidth}
                        />
                      </View>
                      <View
                        style={[
                          styles.maskButtonImageBorder,
                          state.effects.includes(effect) &&
                            styles.maskButtonImageBorderActive
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.maskButtonText,
                        state.effects.includes(effect) &&
                          styles.maskButtonTextActive
                      ]}
                    >
                      {key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.8)"]}
            style={[
              styles.toolbar,
              styles.toolbarInline,
              styles.shadow,
              { paddingBottom: hasInsetBottom ? 20 : 10 }
            ]}
          >
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={this.handleCameraPress}
            >
              <Feather name="camera" size={32} color={color} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={this.handleShufflePress}
            >
              <Feather name="refresh-cw" size={32} color={color} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={this.handleEditPress}
              style={[
                styles.toolbarButton,
                state.edit && styles.toolbarButtonActive
              ]}
            >
              <Feather
                name="sliders"
                size={32}
                color={state.edit ? invertedColor : color}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={this.handleHelpPress}
              style={[
                styles.toolbarButton,
                state.help && styles.toolbarButtonActive
              ]}
            >
              <Feather
                name="help-circle"
                size={32}
                color={state.help ? invertedColor : color}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={this.handleSharePress}
            >
              <Feather name="share" size={32} color={color} />
            </TouchableOpacity>
            {/* <TouchableOpacity
              style={styles.toolbarButton}
              onPress={this.handleExportPress}
            >
              <Feather name="check-square" size={32} color={color} />
            </TouchableOpacity> */}
          </LinearGradient>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  wallpaper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    overflow: "hidden"
  },
  wallpaperPreview: {
    borderRadius: 4
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%"
    // height
  },
  imageEffect: {
    // width: "100%"
  },
  center: {
    justifyContent: "center",
    alignItems: "center"
    // backgroundColor: "transparent"
  },
  centerBlock: {
    marginTop: 100, //toolbar so logo is centered
    flex: 1,
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  toolbarWrapper: {
    width: "100%",
    backgroundColor: "transparent"
  },
  toolbar: {
    paddingHorizontal: 20
  },
  toolbarInline: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  toolbarBlack: {
    backgroundColor: "#1F1F1F",
    paddingVertical: previewsMargin,
    paddingHorizontal: previewsMargin,
    marginBottom: 10
  },
  toolbarButton: {
    padding: 4
  },
  toolbarButtonActive: {
    backgroundColor: "#fff",
    borderRadius: 4
  },
  toolbarText: {
    color: "#fff"
  },
  debugText: {
    fontSize: 10,
    color: "#fff"
  },
  maskButton: {
    width: previewWidth,
    margin: previewMargin
  },
  maskButtonActive: {},
  maskButtonImageBorder: {
    ...StyleSheet.absoluteFillObject
  },
  maskButtonImageBorderActive: {
    borderColor: "#3378F6",
    borderWidth: 3
  },
  maskButtonImageWrapper: {
    height: 80,
    overflow: "hidden"
  },
  maskButtonImage: {
    width: previewWidth,
    height: windowHeight / windowWidth * previewWidth
  },
  maskButtonText: {
    color: "#fff",
    textAlign: "center",
    flexWrap: "wrap",
    paddingVertical: 10
  },
  maskButtonTextActive: {
    color: "#3378F6"
  },
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6
  },
  helpText: {
    color: "#fff",
    padding: 10
  },
  credits: {
    paddingVertical: 10,
    paddingHorizontal: 10
  }
});
