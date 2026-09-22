const webpack = require('@nativescript/webpack');
const path = require('node:path');
const { addEngineBrandingCopyRule } = require('../../bridge/branding/webpack.cjs');
module.exports = env => {
  if (env.android) env.commonjs = true;
  webpack.init(env);
  webpack.chainWebpack(config => config.resolve.modules.prepend(path.resolve(__dirname, 'node_modules')));
  addEngineBrandingCopyRule(webpack);
  webpack.Utils.addCopyRule({from:path.resolve(__dirname,'src/assets/ui'),to:'assets/ui',noErrorOnMissing:false});
  for(const folder of ['levels','assets/audio'])webpack.Utils.addCopyRule({from:path.resolve(__dirname,'../../../Games/games/boxbound',folder),to:'game/'+folder,noErrorOnMissing:false});
  return webpack.resolveConfig();
};
