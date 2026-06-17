const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the shared package so Metro picks up changes.
config.watchFolders = [path.resolve(workspaceRoot, 'shared')];

// Map @crypto-assist/shared directly to the shared/src folder.
config.resolver.extraNodeModules = {
  '@crypto-assist/shared': path.resolve(workspaceRoot, 'shared/src'),
};

module.exports = config;
