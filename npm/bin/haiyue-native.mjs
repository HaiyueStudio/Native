#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  const args = process.argv.slice(2);
  const pkg = JSON.parse(readFileSync(path.join(here, 'package.json')));
  if (args.length === 1 && ['--version', '-v'].includes(args[0])) {
    console.log(`${pkg.name}@${pkg.version}`);
  } else if (!args.length || (args.length === 1 && ['--help', '-h'].includes(args[0]))) {
    console.log('Usage: haiyue-native init <new-directory>\nExtract the frozen Native source project. Requires Node, Git and tar.');
  } else {
    if (args.length !== 2 || args[0] !== 'init' || !args[1]) throw new Error('Usage: haiyue-native init <new-directory>');
    const destination = path.resolve(args[1]);
    let existing = false;
    try { lstatSync(destination); existing = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (existing) throw new Error('Destination already exists; choose a new directory.');
    const archive = path.join(here, 'dist/source.tar.gz');
    const source = JSON.parse(readFileSync(path.join(here, 'dist/source.json')));
    if (source.name !== pkg.name || source.version !== pkg.version) throw new Error('Source identity mismatch');
    if (createHash('sha256').update(readFileSync(archive)).digest('hex') !== source.archiveSha256)
      throw new Error('Source archive checksum mismatch');
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    execFileSync('tar', ['--version'], { stdio: 'ignore' });
    // Exclusive creation refuses existing directories, including broken symlinks.
    mkdirSync(destination);
    execFileSync('tar', ['-xzf', archive, '-C', destination], { stdio: 'inherit' });
    if (createHash('sha256').update(readFileSync(path.join(destination, 'release/candidate.json'))).digest('hex') !== source.manifestSha256)
      throw new Error('Extracted candidate checksum mismatch');
    execFileSync('git', ['init', '-q', destination], { stdio: 'inherit' });
    execFileSync(process.execPath, ['--input-type=module', '-e', "import {verifyCandidate} from './scripts/release/common.mjs'; verifyCandidate();"], { cwd: destination, stdio: 'inherit' });
    console.log(`Created ${pkg.name}@${pkg.version} in ${destination}\nNext: cd into that directory and run npm run release:verify -- --install\nModels and platform tools: games/ASSETS.md and release/README.md`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
