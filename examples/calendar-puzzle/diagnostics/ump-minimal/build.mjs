import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '../..');
const frameworks = process.env.UMP_FRAMEWORKS_DIR || path.join(app, 'platforms/ios/build/Debug-iphonesimulator');
const output = process.argv[2] || '/tmp/haiyue-ump-minimal/UMPProbe.app';
const env = { ...process.env, DEVELOPER_DIR: '/Applications/Xcode.app/Contents/Developer' };
const sdk = execFileSync('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path'], { env, encoding: 'utf8' }).trim();
const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64';
mkdirSync(output, { recursive: true });
writeFileSync(path.join(output, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>org.haiyue.games.calendarpuzzle</string>
<key>CFBundleName</key><string>UMPProbe</string>
<key>CFBundleDisplayName</key><string>UMP Probe</string>
<key>CFBundleExecutable</key><string>UMPProbe</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>MinimumOSVersion</key><string>15.0</string>
<key>UIDeviceFamily</key><array><integer>1</integer></array>
<key>LSRequiresIPhoneOS</key><true/>
<key>UILaunchScreen</key><dict/>
<key>GADApplicationIdentifier</key><string>ca-app-pub-2053256758816744~9316994454</string>
</dict></plist>`);
execFileSync('xcrun', ['clang', '-target', `${arch}-apple-ios15.0-simulator`, '-isysroot', sdk,
  '-fobjc-arc', '-fmodules', '-ObjC', '-F', frameworks,
  '-framework', 'UIKit', '-framework', 'Foundation', '-framework', 'WebKit',
  '-framework', 'UserMessagingPlatform', path.join(here, 'main.m'), path.join(here, 'network-trace.m'), '-o', path.join(output, 'UMPProbe')],
  { env, stdio: 'inherit' });
execFileSync('codesign', ['--force', '--sign', '-', output], { env, stdio: 'inherit' });
console.log(output);
