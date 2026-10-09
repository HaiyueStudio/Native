import {mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const [device, destination, appId = 'org.haiyue.nativevalidation'] = process.argv.slice(2);
if (!device || !destination) throw Error('Usage: node collect-ios.mjs DEVICE OUTPUT_DIRECTORY [TEST_BUNDLE_ID]');
if (!/^org\.haiyue\.nativevalidation(?:\.[a-z][a-z0-9]*)*$/.test(appId)) throw Error('Expected an isolated Native validation bundle ID');
mkdirSync(destination, {recursive: true});
execFileSync('xcrun', ['devicectl', 'device', 'copy', 'from', '--device', device,
  '--domain-type', 'appDataContainer', '--domain-identifier', appId,
  '--source', 'Documents/att-validation.jsonl', '--destination', path.resolve(destination, 'att-validation.jsonl'), '--timeout', '30'],
  {stdio: 'inherit', env: {...process.env, DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer'}});
