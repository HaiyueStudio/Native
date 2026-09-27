import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../package.json', import.meta.url));
const ts = require('typescript');
export function loadTS(file, mocks = {}, globals = {}, cache = new Map()) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  runInNewContext(code, { exports, Date, Promise, Error, console, setTimeout, clearTimeout, ...globals,
    require: name => name in mocks ? mocks[name] : name.startsWith('.') ? loadTS(path.resolve(path.dirname(file), name + '.ts'), mocks, globals, cache) : require(name),
  }, { filename: file });
  return exports;
}
