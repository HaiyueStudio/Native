import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
const source = new URL('../src/pbr-scene.ts', import.meta.url);
const output = new URL('../artifacts/g03/', import.meta.url);
mkdirSync(output, { recursive: true });
writeFileSync(new URL('pbr-scene.js', output), ts.transpileModule(readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText);
