import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const app = fileURLToPath(new URL('..', import.meta.url));
test('Native bootstrap supplies a real structured clone for the seven-part public scene', () => {
  execFileSync(process.execPath, ['--input-type=module', '-e', String.raw`
    import assert from 'node:assert/strict';
    import {createRequire} from 'node:module';
    import {readFileSync} from 'node:fs';
    import {parseHyaComposition} from '@haiyue/animation-spec/hya-production';
    const require = createRequire(import.meta.url);
    const ts = require('typescript');
    const source = JSON.parse(readFileSync('src/assets/scene.json'));
    const original = globalThis.structuredClone;
    delete globalThis.structuredClone;
    delete globalThis.PerformanceMark;
    assert.throws(() => parseHyaComposition(source), e => e.path === '$.parts[0].document');
    const clone = require('core-js-pure/actual/structured-clone');
    const bridge = ts.transpileModule(readFileSync('../../bridge/storage/clone-runtime.ts', 'utf8'), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText;
    const {installNativeSaveRuntime} = await import('data:text/javascript;base64,' + Buffer.from(bridge).toString('base64'));
    installNativeSaveRuntime(clone);
    assert.deepEqual(parseHyaComposition(source).diagnostics, []);
    const input = {bytes: new Uint8Array([0, 255]), map: new Map([['key', new Set([1])]])};
    input.self = input;
    const copy = structuredClone(input);
    assert.equal(copy.self, copy);
    assert.notEqual(copy.bytes.buffer, input.bytes.buffer);
    assert.deepEqual(copy.bytes, input.bytes);
    assert.notEqual(copy.map, input.map);
    // core-js-pure collections use their own prototype; verify contents and ownership.
    assert.equal(copy.map.size, 1);
    assert.deepEqual([...copy.map.keys()], ['key']);
    assert.notEqual(copy.map.get('key'), input.map.get('key'));
    assert.deepEqual([...copy.map.get('key')], [1]);
    assert.throws(() => structuredClone(() => {}), {name: 'DataCloneError'});
    globalThis.structuredClone = original;
    installNativeSaveRuntime(clone);
    assert.equal(globalThis.structuredClone, original);
    const entry = readFileSync('src/app.ts', 'utf8');
    assert.ok(entry.indexOf('installNativeSaveRuntime(clone)') < entry.indexOf('Application.run'));
  `], {cwd: app, encoding: 'utf8'});
});
for (const platform of [{ios: true}, {platform: 'ios'}]) {
  test(`iOS expands Unicode properties without enabling HMR: ${JSON.stringify(platform)}`, () => {
    // NativeScript keeps global configuration state, so resolve each CLI form separately.
    execFileSync(process.execPath, ['-e', String.raw`
      const assert = require('node:assert/strict');
      const babel = require('@babel/core');
      const config = require('./webpack.config.js')(JSON.parse(process.argv[1]));
      assert.equal(config.output.module, true);
      assert.equal(config.plugins.some(p => p.constructor.name === 'HotModuleReplacementPlugin'), false);
      const codecRule = config.module.rules.find(r => r.resolve?.alias?.['./TextEncoder$']);
      assert.ok(codecRule.test(require.resolve('@nativescript/canvas')));
      assert.equal(codecRule.test(require.resolve('@nativescript/core')), false);
      assert.equal(codecRule.resolve.alias['./TextEncoder$'], codecRule.resolve.alias['./TextDecoder$']);
      const {TextEncoder: Utf8Encoder, TextDecoder: Utf8Decoder} = require(codecRule.resolve.alias['./TextEncoder$']);
      const encoder = new Utf8Encoder();
      assert.deepEqual(Array.from(encoder.encode('你好 A')), [228,189,160,229,165,189,32,65]);
      for (const value of ['你好 A', 'e\u0301', '👩🏽‍💻😀', '\u0000', '']) {
        assert.equal(new Utf8Decoder('utf-8', {fatal: true}).decode(encoder.encode(value)), value);
      }
      assert.deepEqual(Array.from(encoder.encode('\ud800')), [239,191,189]);
      const padded = new Uint8Array([0xff, 65, 66, 0xff]);
      assert.equal(new Utf8Decoder('utf-8', {fatal: true}).decode(padded.subarray(1, 3)), 'AB');
      assert.throws(() => new Utf8Decoder('utf-8', {fatal: true}).decode(new Uint8Array([0xe4,0xbd])));
      assert.throws(() => new Utf8Decoder('utf-8', {fatal: true}).decode(new Uint8Array([0xc0,0xaf])));
      const bom = new Uint8Array([239,187,191,65]);
      assert.equal(new Utf8Decoder().decode(bom), 'A');
      assert.equal(new Utf8Decoder('utf-8', {ignoreBOM: true}).decode(bom), '\ufeffA');
      const stream = new Utf8Decoder('utf-8', {fatal: true});
      assert.equal(stream.decode(new Uint8Array([228,189]), {stream: true}), '');
      assert.equal(stream.decode(new Uint8Array([160])), '你');
      const rule = config.module.rules.find(r => r.use?.[0]?.options?.plugins?.some(p => p.includes('transform-unicode-property-regex')));
      assert.ok(rule, 'iOS must transform Unicode properties at the consumer build boundary');
      const source = 'result = /\\p{Mark}/u;';
      const transformed = babel.transformSync(source, rule.use[0].options).code;
      assert.equal(transformed.includes('\\p{'), false);
      const match = new Function('let result; ' + transformed + '; return result;')();
      const original = new RegExp('\\p{Mark}', 'u');
      for (const value of ['a', '你', 'é', 'e\u0301', '\u0301', '\u093e', '\u20dd', '\ufe0f', '\u{1d165}', '😀', '👩🏽‍💻', '']) {
        assert.equal(match.test(value), original.test(value), JSON.stringify(value));
      }
    `, JSON.stringify({...platform, hmr: false, nativescriptLibPath: true})], {cwd: app, encoding: 'utf8'});
    assert.ok(true);
  });
}
