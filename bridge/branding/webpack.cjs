const path = require('node:path');

/** Ship only the small transparent logo, never the production master. */
function addEngineBrandingCopyRule(webpack) {
  webpack.Utils.addCopyRule({
    from: path.join(__dirname, 'assets/haiyue-moon.png'),
    to: 'branding/haiyue-moon.png',
    noErrorOnMissing: false,
  });
}
module.exports = { addEngineBrandingCopyRule };
