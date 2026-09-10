import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { GameSaveService, LocalStorageSaveBackend } from '@haiyue/engine/save';
const source = readFileSync(new URL('../../../bridge/storage/clone-runtime.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { installNativeSaveRuntime } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('real Engine save survives a new service when native structuredClone is absent', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'structuredClone');
  delete globalThis.structuredClone;
  const values = new Map();
  const storage = { get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const options = { gameId: 'native-spider-save-test', dataVersion: 1,
    backend: new LocalStorageSaveBackend({ storage }), validateData: data => Array.isArray(data.columns) };
  try {
    const unavailable = new GameSaveService(options);
    await assert.rejects(unavailable.save({ saveId: 'autosave', name: 'Spider', data: { columns: [] } }), /could not be cloned/);
    const { default: clone } = await import('core-js-pure/actual/structured-clone.js');
    installNativeSaveRuntime(clone);
    const data = { columns: [[{ id: 7, faceUp: true }]], moves: 1, stock: [] };
    const service = new GameSaveService(options);
    await service.save({ saveId: 'autosave', name: 'Spider', kind: 'autosave', data });
    data.columns[0][0].id = 99;
    const reopened = new GameSaveService(options);
    assert.equal((await reopened.load('autosave')).data.columns[0][0].id, 7);
    assert.equal((await reopened.load('autosave')).data.moves, 1);
    installNativeSaveRuntime(() => { throw new Error('must not replace an existing implementation'); });
    assert.deepEqual(globalThis.structuredClone({ a: [1] }), { a: [1] });
  } finally {
    if (previous) Object.defineProperty(globalThis, 'structuredClone', previous);
    else delete globalThis.structuredClone;
  }
});
