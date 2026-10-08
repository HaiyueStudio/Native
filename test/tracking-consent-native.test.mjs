import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
test('native TCF eligibility requires explicit relevant consent and rejects missing/malformed choices', { skip: process.platform !== 'darwin' }, () => {
  const output = mkdtempSync(path.join(os.tmpdir(), 'haiyue-tracking-consent-'));
  try {
    execFileSync('xcrun', ['swiftc', '-module-cache-path', path.join(output, 'cache'),
      path.join(root, 'bridge/rewards/native/ios/HYTrackingConsent.swift'),
      path.join(root, 'test/fixtures/tracking-consent/main.swift'), '-o', path.join(output, 'check')], { stdio: 'pipe', timeout: 60000 });
    execFileSync(path.join(output, 'check'), [], { stdio: 'pipe', timeout: 60000 });
  } finally { rmSync(output, { recursive: true, force: true }); }
});
