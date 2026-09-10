import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { assertOrientationSupported, orientationPlistValues } from '../../../bridge/display/orientation-policy.ts';
export function syncOrientation() {
  const policy = JSON.parse(readFileSync(new URL('../orientation.json', import.meta.url), 'utf8'));
  assertOrientationSupported(policy.initial, policy.supported);
  const values = JSON.stringify(orientationPlistValues(policy.supported));
  const plist = fileURLToPath(new URL('../App_Resources/iOS/Info.plist', import.meta.url));
  for (const key of ['UISupportedInterfaceOrientations', 'UISupportedInterfaceOrientations~ipad']) {
    execFileSync('/usr/bin/plutil', ['-replace', key, '-json', values, plist]);
  }
}
