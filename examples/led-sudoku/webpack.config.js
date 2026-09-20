const webpack = require('@nativescript/webpack');
const path = require('node:path');
const { addEngineBrandingCopyRule } = require('../../bridge/branding/webpack.cjs');
module.exports = env => {
  if (env.android) env.commonjs = true;
  webpack.init(env);
  webpack.chainWebpack(config => config.resolve.modules.prepend(path.resolve(__dirname, 'node_modules')));
  addEngineBrandingCopyRule(webpack);
  return webpack.resolveConfig();
};
