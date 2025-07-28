const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Allow .cjs imports for Firebase
config.resolver.sourceExts.push('cjs');
// Fix Firebase package exports issue
config.resolver.unstable_enablePackageExports = false;

// Apply NativeWind configuration
module.exports = withNativeWind(config, { input: './global.css' });
