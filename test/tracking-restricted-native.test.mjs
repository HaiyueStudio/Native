import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
test('native restricted ATT skips prompting and preserves startup, consent and reward boundaries', { skip: process.platform !== 'darwin' }, () => {
  const output = mkdtempSync(path.join(os.tmpdir(), 'haiyue-tracking-restricted-'));
  try {
    // Compile the complete production class. Only SDK imports are replaced by
    // deterministic test doubles; no permission branch is copied or rewritten.
    const source = readFileSync(path.join(root, 'bridge/rewards/native/ios/HYRewardedAds.swift'), 'utf8');
    const imports = source.match(/^import (UIKit|GoogleMobileAds|UserMessagingPlatform|AppTrackingTransparency)$/gm);
    assert.equal(imports?.length, 4);
    const native = path.join(output, 'HYRewardedAds.swift');
    const plist = path.join(output, 'Info.plist');
    writeFileSync(plist, '<?xml version="1.0"?><plist version="1.0"><dict><key>NSUserTrackingUsageDescription</key><string>Automated test fixture only</string></dict></plist>');
    writeFileSync(native, 'import Foundation\n' + source.replace(/^import (UIKit|GoogleMobileAds|UserMessagingPlatform|AppTrackingTransparency)\n/gm, ''));
    execFileSync('xcrun', ['swiftc', '-parse-as-library', '-module-cache-path', path.join(output, 'cache'),
      native, path.join(root, 'bridge/rewards/native/ios/HYTrackingConsent.swift'),
      path.join(root, 'test/fixtures/tracking-restricted/SDKDoubles.swift'),
      path.join(root, 'test/fixtures/tracking-restricted/Acceptance.swift'),
      '-Xlinker', '-sectcreate', '-Xlinker', '__TEXT', '-Xlinker', '__info_plist', '-Xlinker', plist,
      '-o', path.join(output, 'check')], { stdio: 'pipe', timeout: 60000 });
    const result = execFileSync(path.join(output, 'check'), [], { encoding: 'utf8', timeout: 15000 });
    assert.match(result, /restricted ATT: 6 scenarios passed/);
  } finally { rmSync(output, { recursive: true, force: true }); }
});
