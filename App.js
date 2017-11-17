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
  Button
} from "react-native";
import { takeSnapshotAsync, Permissions, Constants, ImagePicker } from "expo";
import { Feather } from "@expo/vector-icons";

import effectsList from "./assets/effects";
import imagesList from "./assets/wallpapers";
import { windowHeight, windowWidth, hasInsetBottom } from "./platform.js";

const getRandomImage = () =>
  imagesList[Math.floor(Math.random() * imagesList.length)];

const widthCoeff = 4;
const previewsMargin = 6;
const previewMargin = 2;
const previewWidth = windowWidth / widthCoeff - previewMargin * 4;

class Wallpaper extends React.Component {
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
          effect.map(image => (
            <Image
              key={i}
              source={image.file}
              style={[
                styles.imageEffect,
                image.style({
                  width,
                  height,
                  imageWidth: Image.resolveAssetSource(image.file).width,
                  imageHeight: Image.resolveAssetSource(image.file).height
                })
              ]}
              resizeMode={image.resizeMode}
            />
          ))
        )}
      </View>
    );
  }
}

export default class App extends React.Component {
  state = {
    effects: [effectsList["Rounded Notch"]],
    image: getRandomImage(),
    // help: process.env.NODE_ENV !== "production",
    help: false,
    // edit: process.env.NODE_ENV !== "production"
    edit: false
  };

  saveWallpaperRef = ref => {
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

  handleCameraPress = async () => {
    this.setState({ cameraRoll: true });
    const imageFromLib = await ImagePicker.launchImageLibraryAsync();
    if (!imageFromLib.cancelled) {
      this.setState({ image: { file: imageFromLib } });
    }
    this.setState({ cameraRoll: false });
  };

  handleShufflePress = () => {
    this.setState({ image: getRandomImage() });
  };

  handleHelpPress = () => {
    this.setState(prevState => ({ help: !prevState.help }));
  };

  handleEditPress = () => {
    this.setState(prevState => ({ edit: !prevState.edit }));
  };

  handleExportPress = async () => {
    if (await this.getCameraPermission()) {
      const newWallpaper = await takeSnapshotAsync(this._wallpaperView, {
        format: "png",
        quality: 1,
        result: "file", // 'file' 'base64' 'data-uri'
        width: windowWidth,
        height: windowHeight
      });
      this.setState({ log: newWallpaper });
      try {
        await CameraRoll.saveToCameraRoll(newWallpaper);
        this.setState({ saved: true });
        setTimeout(
          () =>
            this.setState({
              log: undefined,
              saved: false
            }),
          3000
        );
      } catch (error) {
        this.setState({ error });
      }
    }
  };

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
          {state.saved && (
            <View style={styles.center}>
              <Feather name="check-square" size={64} color={color} />
              <Text style={[styles.toolbarText]}>
                Saved to your camera roll
              </Text>
            </View>
          )}
        </View>
        <View style={styles.toolbarWrapper}>
          {/* {process.env.NODE_ENV !== "production" && (
            <View
              style={[styles.toolbar, styles.toolbarInline, { opacity: 0.2 }]}
            >
              <Text style={[styles.toolbarText]}>
                Debug: {JSON.stringify(Constants.platform.ios)}
              </Text>
              {state.error && (
                <Text style={[styles.toolbarText]}>
                  {state.error.toString()}
                </Text>
              )}
              {state.log && (
                <Text style={[styles.toolbarText]}>
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
                      Image {state.image.author &&
                        "by " + state.image.author}{" "}
                      from Unsplash.com
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
                  3. <Feather
                    name="check-square"
                    size={16}
                    color={color}
                  />{" "}
                  Save it to your camera roll
                </Text>
                <Text style={styles.helpText}>
                  4. Quit the app and set the saved picture as your wallpaper
                  (as you normally do).
                </Text>
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
                          })}
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
          <View style={[styles.toolbar, styles.toolbarInline, styles.shadow]}>
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
              onPress={this.handleExportPress}
            >
              <Feather name="check-square" size={32} color={color} />
            </TouchableOpacity>
          </View>
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
    marginBottom: hasInsetBottom ? 20 : 10,
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
