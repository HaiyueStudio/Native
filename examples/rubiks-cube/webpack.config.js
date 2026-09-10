const webpack = require('@nativescript/webpack');
const path = require('node:path');
module.exports = env => {
  webpack.init(env);
  webpack.chainWebpack(config => {
    config.resolve.modules.prepend(path.resolve(__dirname, 'node_modules'));
  });
  return webpack.resolveConfig();
};
