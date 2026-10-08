export function isBridgePackageFile(file) {
  return file.startsWith('bridge/') && !file.split('/').includes('evidence') && (/\.(?:ts|swift|java|md)$/.test(file)
    || file === 'bridge/branding/webpack.cjs' || file === 'bridge/monetization/build.cjs'
    || file === 'bridge/share/android/haiyue_share_paths.xml'
    || file === 'bridge/branding/assets/haiyue-moon.png');
}
