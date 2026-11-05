const webpack = require('@nativescript/webpack');
const path = require('node:path');
module.exports = env => {
  const ios = Boolean(env.ios || env.platform === 'ios');
  webpack.init(env);
  webpack.Utils.addCopyRule({from:path.resolve(__dirname,'qualified-candidate.json'),to:'qualified-candidate.json',noErrorOnMissing:false});
  webpack.Utils.addCopyRule({from:path.resolve(__dirname,'src/assets'),to:'assets',noErrorOnMissing:false});
  webpack.chainWebpack(config => {config.resolve.modules.prepend(path.resolve(__dirname,'node_modules'));});
  const config = webpack.resolveConfig();
  // This iOS runtime cannot parse Unicode property escapes. Expand their
  // character sets at the host build boundary; keep candidate tarballs intact.
  if (ios) config.module.rules.push({
    test: /\.m?js$/,
    include: [path.resolve(__dirname, 'node_modules/@haiyue')],
    use: [{loader: require.resolve('babel-loader'), options: {
      babelrc: false, configFile: false, compact: true,
      plugins: [require.resolve('@babel/plugin-transform-unicode-property-regex')],
    }}],
  });
  // Canvas 2.1.18 replaces the global text codecs with its native wrappers.
  // Use strict UTF-8 codecs before consumers cache their decoder instances.
  if (ios) config.module.rules.push({
    test: file => file === require.resolve('@nativescript/canvas'),
    resolve: {alias: {
      './TextEncoder$': require.resolve('text-encoding-utf-8'),
      './TextDecoder$': require.resolve('text-encoding-utf-8'),
    }},
  });
  const opentypeDist = path.dirname(require.resolve('opentype.js'));
  // Honor OpenType 1.3.4's own browser fs:false mapping only in its parser.
  // Fonts enter through the resource byte port; Node font-file export is unused.
  config.module.rules.push({
    test: file => file === path.join(opentypeDist, 'opentype.module.js'),
    resolve: {alias: {fs: false}},
  });
  return config;
};
