import { File, knownFolders, path } from '@nativescript/core';
/** Launch-only native crash localization; never enabled during ordinary play. */
export function startupTrace() {
  const enabled = String(NSProcessInfo.processInfo.environment.objectForKey('SPIDER_TRACE_STARTUP')) === '1';
  const file = File.fromPath(path.join(knownFolders.documents().path, 'spider-startup.jsonl'));
  const lines: string[] = [];
  let active = enabled;
  const trace = (event: string) => {
    if (!active) return;
    lines.push(JSON.stringify({ time: Date.now(), event }));
    if (lines.length > 80) lines.shift();
    file.writeTextSync(lines.join('\n'));
  };
  return { trace, stop() { trace('first-frame-complete'); active = false; } };
}
