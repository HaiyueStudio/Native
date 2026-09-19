const webpack = require('@nativescript/webpack');
const path = require('node:path');
module.exports = env => {
  webpack.init(env);
  webpack.chainWebpack(config => {
    config.resolve.modules.prepend(path.resolve(__dirname, 'node_modules'));
  });
  webpack.Utils.addCopyRule({ from: path.resolve(__dirname, '../../../Games/games/calendar-puzzle/assets/audio'), to: 'game-assets/audio', globOptions: { ignore: ['**/*.mid', '**/*.json'] }, noErrorOnMissing: false });
  return webpack.resolveConfig();
};
