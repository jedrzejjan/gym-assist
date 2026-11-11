const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Drizzle's expo migrations bundle the generated .sql files.
config.resolver.sourceExts.push('sql');

module.exports = config;
