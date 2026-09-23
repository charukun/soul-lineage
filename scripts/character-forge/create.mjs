import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// The default is the pinned upstream state machine, never the deprecated loft.
const script=fileURLToPath(new URL('../../packages/assets/forge/upstream_workspace.py',import.meta.url));
const args=process.argv.slice(2),commands=new Set(['create','next','run','mark']);
if(!commands.has(args[0]))args.unshift('create');
const result=spawnSync(process.env.CHARACTER_FORGE_PYTHON||'python3',[script,...args],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
