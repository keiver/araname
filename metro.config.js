const {getDefaultConfig} = require("expo/metro-config")

module.exports = (() => {
  const config = getDefaultConfig(__dirname)

  const {transformer, resolver} = config

  // Add svg to assetExts to maintain default behavior for other assets
  config.resolver.assetExts = resolver.assetExts.filter(ext => ext !== "svg")

  // Add svg to sourceExts to transform svg files
  config.resolver.sourceExts = [...resolver.sourceExts, "svg"]

  // Configure the svg transformer
  config.transformer.babelTransformerPath = require.resolve("react-native-svg-transformer")

  return config
})()
