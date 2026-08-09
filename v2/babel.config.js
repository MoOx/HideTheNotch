module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated 4 délègue la transformation des worklets à react-native-worklets.
    // Ce plugin doit rester le dernier de la liste.
    plugins: ["react-native-worklets/plugin"],
  };
};
