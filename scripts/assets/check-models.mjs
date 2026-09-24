import path from 'node:path';
import { parseArgs } from 'node:util';
import { root, readConfig, readJSON, verifyModelInputs } from '../release/common.mjs';

try {
  const { values } = parseArgs({ options: { app: { type: 'string' } } });
  const config = readConfig();
  if (values.app && !Object.hasOwn(config.apps, values.app)) throw new Error(`Unknown app: ${values.app}`);
  const apps = values.app ? [values.app] : Object.keys(config.apps);
  const assets = path.resolve(process.env.HAIYUE_MODEL_ASSETS || path.join(root, 'local-assets'));
  const inputs = Object.keys(readJSON(path.join(root, 'release/model-inputs.json')).files)
    .filter(file => apps.includes(file.split('/')[0]));
  if (!inputs.length) console.log('Selected apps require no external models.');
  else {
    console.log(`Model input directory: ${assets}`);
    for (const input of inputs) console.log(`Required: ${path.join(assets, input)}`);
    let failed = false;
    for (const app of [...new Set(inputs.map(file => file.split('/')[0]))]) {
      try { verifyModelInputs([app], root, assets); console.log(`[passed] ${app}: model hashes match`); }
      catch (error) { console.error(`[failed] ${app}: ${error.message}`); failed = true; }
    }
    if (failed) {
      console.error('No model download is provided. See games/ASSETS.md for compatible inputs or model-free examples.');
      process.exitCode = 1;
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
