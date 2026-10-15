import test from 'node:test';
import { execFileSync } from 'node:child_process';

test('native bootstrap supports achievement locale switching without a built-in Intl global', () => {
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    delete globalThis.Intl;
    await import('@formatjs/intl-getcanonicallocales/polyfill.js');
    const { I18n, collectLocaleCharacters } = await import('@haiyue/extensions/i18n');
    const packs = ['en', 'zh-CN'].map(locale => ({ schemaVersion: 1, locale, messages: { title: locale } }));
    assert.ok(collectLocaleCharacters(packs).includes('e'));
    const i18n = new I18n({ locale: 'zh-CN', fallbackLocale: 'en' });
    packs.forEach(pack => i18n.register(pack));
    assert.equal(i18n.text('title'), 'zh-CN');
    await i18n.setLocale('en');
    assert.equal(i18n.text('title'), 'en');
    i18n.dispose();
  `], { stdio: 'pipe', cwd: new URL('..', import.meta.url) });
});
