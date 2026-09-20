const webpack = require('@nativescript/webpack');
const path = require('node:path');
module.exports = env => {
  // Android 9.0.3 can reuse disposed V8 handles when an ESM worker is loaded
  // again (ModuleInternal::LoadESModule / GlobalHandles::Destroy SIGBUS).
  // Use the runtime's supported CommonJS bundle path for this Android app.
  if (env.android) env.commonjs = true;
  webpack.init(env);
  webpack.chainWebpack(config => {
    config.resolve.modules.prepend(path.resolve(__dirname, 'node_modules'));
  });
  webpack.Utils.addCopyRule({ from: path.resolve(__dirname, '../../../Games/games/calendar-puzzle/assets/audio'), to: 'game-assets/audio', globOptions: { ignore: ['**/*.mid', '**/*.json'] }, noErrorOnMissing: false });
  webpack.Utils.addCopyRule({ from: path.resolve(__dirname, '../../bridge/branding/assets/haiyue-moon.png'), to: 'branding/haiyue-moon.png', noErrorOnMissing: false });
  return webpack.resolveConfig();
};
