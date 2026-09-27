export function isBridgePackageFile(file) {
  return file.startsWith('bridge/') && !file.split('/').includes('evidence') && (/\.(?:ts|swift|java|md)$/.test(file)
    || file === 'bridge/branding/webpack.cjs' || file === 'bridge/monetization/build.cjs'
    || file === 'bridge/branding/assets/haiyue-moon.png');
}
