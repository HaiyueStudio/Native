const path = require('node:path');
/** Merge NativeSource and entitlements into the app configuration; does not edit profiles. */
function gameCenterBuild() {
  return {
    ios: { NativeSource: [{ name: 'HaiyueGameCenter', path: path.relative(process.cwd(), path.join(__dirname, 'native/*.swift')).split(path.sep).join('/') }] },
    entitlements: { 'com.apple.developer.game-center': true },
  };
}
module.exports = { gameCenterBuild };
