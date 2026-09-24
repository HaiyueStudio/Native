const webpack = require('@nativescript/webpack');
const path = require('node:path');
const { addEngineBrandingCopyRule } = require('../../bridge/branding/webpack.cjs');
module.exports = env => {
  webpack.init(env);
  addEngineBrandingCopyRule(webpack);
  webpack.chainWebpack(config => {
    config.resolve.modules.prepend(path.resolve(__dirname, 'node_modules'));
  });
  webpack.Utils.addCopyRule({ from: path.resolve(__dirname, 'src/game-assets'), to: 'game-assets', noErrorOnMissing: false });
  return webpack.resolveConfig();
};
