const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Allow .cjs imports for Firebase
config.resolver.sourceExts.push('cjs');

// Fix Firebase package exports issue
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
