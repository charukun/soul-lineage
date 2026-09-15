import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const values = Object.fromEntries(process.argv.slice(2).reduce((rows, value, index, all) => {
  if (value.startsWith('--')) rows.push([value.slice(2), all[index + 1]]);
  return rows;
}, []));
const input = values.input ? resolve(values.input) : '';
if (!input || !existsSync(input)) throw new Error('Use --input <.blend/.glb/.gltf>');
const output = resolve(values.output || input.replace(/\.(blend|glb|gltf)$/i, '.lod.glb'));
const audit = resolve(values.audit || `${output}.audit.json`);
const mode = values.mode || 'static';
const blender = process.env.BLENDER_BIN || 'blender';
const script = resolve('scripts/blender/generate-lods.py');
const scriptArgs = ['--output', output, '--audit', audit, '--mode', mode, '--lod1', values.lod1 || '.55', '--lod2', values.lod2 || '.25'];
let args;
if (extname(input).toLowerCase() === '.blend') args = ['--background', input, '--python', script, '--', ...scriptArgs];
else args = ['--background', '--python', script, '--', '--input', input, ...scriptArgs];
execFileSync(blender, args, { stdio: 'inherit' });
if (!existsSync(output) || !existsSync(audit)) throw new Error('Blender LOD build did not produce expected artifacts');
console.log(JSON.stringify({ input, output, audit, mode }));
