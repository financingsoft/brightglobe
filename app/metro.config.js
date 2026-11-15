const { getDefaultConfig } = require("expo/metro-config");

module.exports = (() => {
  const config = getDefaultConfig(__dirname);
  config.transformer = {
    ...config.transformer,
    babelTransformerPath: require.resolve("react-native-qrcode-svg/textEncodingTransformation")
  };
  return config;
})();
