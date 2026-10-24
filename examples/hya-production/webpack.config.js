const webpack = require('@nativescript/webpack');
const path = require('node:path');
module.exports = env => {
  webpack.init(env);
  webpack.Utils.addCopyRule({from:path.resolve(__dirname,'qualified-candidate.json'),to:'qualified-candidate.json',noErrorOnMissing:false});
  webpack.Utils.addCopyRule({from:path.resolve(__dirname,'src/assets'),to:'assets',noErrorOnMissing:false});
  webpack.chainWebpack(config => {config.resolve.modules.prepend(path.resolve(__dirname,'node_modules'));});
  const config = webpack.resolveConfig();
  const opentypeDist = path.dirname(require.resolve('opentype.js'));
  // Honor OpenType 1.3.4's own browser fs:false mapping only in its parser.
  // Fonts enter through the resource byte port; Node font-file export is unused.
  config.module.rules.push({
    test: file => file === path.join(opentypeDist, 'opentype.module.js'),
    resolve: {alias: {fs: false}},
  });
  return config;
};
