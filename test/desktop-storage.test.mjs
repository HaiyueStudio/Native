import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { webcrypto } from 'node:crypto';
import { loadTS } from './support/load-ts.mjs';

function fixture() {
  const directory = fs.mkdtempSync(join(tmpdir(), 'haiyue-desktop-storage-'));
  let failWrite = false;
  const Deno = {
    mkdirSync: fs.mkdirSync, readTextFileSync: path => fs.readFileSync(path, 'utf8'),
    renameSync: fs.renameSync, removeSync: fs.unlinkSync,
    readDirSync: path => fs.readdirSync(path, { withFileTypes: true }).map(e => ({ name: e.name, isFile: e.isFile() })),
    errors: { NotFound: class { static [Symbol.hasInstance](error) { return error?.code === 'ENOENT'; } } },
    openSync(path) {
      const fd = fs.openSync(path, 'wx');
      return { writeSync(bytes) { if (failWrite) throw new Error('simulated-full'); return fs.writeSync(fd, bytes); }, syncSync() { fs.fsyncSync(fd); }, close() { fs.closeSync(fd); } };
    },
  };
  const { DesktopStorage } = loadTS('desktop/host/storage.ts', {}, { Deno, crypto: webcrypto, TextEncoder });
  return { directory, storage: new DesktopStorage(directory), reopen: () => new DesktopStorage(directory), fail() { failWrite = true; }, cleanup() { fs.rmSync(directory, { recursive: true, force: true }); } };
}
test('desktop Storage preserves Unicode keys and enumeration across reopening without unsafe filenames', () => {
  const f = fixture();
  try {
    const keys = ['中文/../保存', 'a'.repeat(500)];
    keys.forEach((key, i) => f.storage.setItem(key, String(i)));
    const reopened = f.reopen(); assert.equal(reopened.length, 2);
    assert.deepEqual([reopened.key(0), reopened.key(1)].sort(), keys.sort()); assert.equal(reopened.key(2), null);
    assert.equal(reopened.getItem('中文/../保存'), '0');
    assert.ok(fs.readdirSync(f.directory).every(name => /^[a-f0-9]{64}\.entry\.json$/.test(name)));
    reopened.clear(); assert.equal(f.storage.length, 0); assert.equal(f.storage.getItem('missing'), null);
  } finally { f.cleanup(); }
});
test('failed atomic replacement retains old content, cleans temporary file, and corrupt entries fail closed', () => {
  const f = fixture();
  try {
    f.storage.setItem('save', 'old'); f.fail(); assert.throws(() => f.storage.setItem('save', 'new'), /simulated-full/);
    assert.equal(f.reopen().getItem('save'), 'old'); assert.equal(fs.readdirSync(f.directory).length, 1);
    fs.writeFileSync(join(f.directory, fs.readdirSync(f.directory)[0]), '{"format":"unknown"}');
    assert.throws(() => f.storage.getItem('save'), /Invalid desktop storage/);
    assert.throws(() => f.storage.length, /Invalid desktop storage/);
  } finally { f.cleanup(); }
});
