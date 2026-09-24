import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { root, manifestPath, readConfig, readJSON, command, selectedFiles, dependencies, verifyRelativeImports } from './common.mjs';
try {
  if (process.argv.length > 2) throw new Error('Usage: npm run release:freeze (candidate comes from release/config.json)');
  const config = readConfig();
  if (existsSync(manifestPath) && readJSON(manifestPath).candidate === config.candidate) throw new Error('This candidate is already frozen. Choose a new version in package.json, package-lock.json and release/config.json before freezing again.');
  if (readJSON(path.join(root, 'package.json')).version !== config.candidate) throw new Error('Root package version must match candidate');
  const inventory = dependencies(config);
  const candidate = {
    schemaVersion: 1, candidate: config.candidate, status: config.candidate.includes('-') ? 'source-candidate' : 'source-release', frozenAt: new Date().toISOString(),
    // Revisions locate the baseline. Content hashes also cover uncommitted inputs.
    baselines: { Native: command('git', ['rev-parse', 'HEAD']), Games: command('git', ['rev-parse', 'HEAD'], path.resolve(root, '../Games')) },
    toolchain: config.toolchain, platforms: config.apps,
    files: selectedFiles(config), dependencies: inventory,
  };
  verifyRelativeImports(candidate.files);
  writeFileSync(manifestPath, JSON.stringify(candidate, null, 2) + '\n');
  console.log(`Frozen ${candidate.candidate}: ${Object.keys(candidate.files).length} inputs. Run npm run release:verify.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
