import { mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), output = resolve(root, 'build');
mkdirSync(output, { recursive: true });
const tools = JSON.parse(readFileSync(resolve(output, 'tools.json'), 'utf8'));
copyFileSync(tools.audioHeader, resolve(output, 'miniaudio.h'));
const source = resolve(root, 'native/audio.c');
if (process.platform === 'darwin') {
  execFileSync('cc', ['-O2', '-mmacosx-version-min=12.0', '-dynamiclib', '-fvisibility=hidden', '-I', output, source,
    '-framework', 'CoreAudio', '-framework', 'AudioToolbox', '-framework', 'CoreFoundation', '-lpthread', '-o', resolve(output, 'libhaiyue_audio.dylib')], { stdio: 'inherit' });
} else if (process.platform === 'win32') {
  // Run from an x64 Visual Studio Developer PowerShell.
  execFileSync('cl', ['/nologo', '/O2', '/MT', '/LD', `/I${output}`, source, '/link', `/OUT:${resolve(output, 'haiyue_audio.dll')}`, 'ole32.lib', 'winmm.lib'], { cwd: output, stdio: 'inherit' });
} else throw new Error('Audio target not supported');
