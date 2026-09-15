import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const args=Object.fromEntries(process.argv.slice(2).reduce((rows,value,index,all)=>{if(value.startsWith('--'))rows.push([value.slice(2),all[index+1]]);return rows;},[]));
if(!args.input||!args.output)throw new Error('Use --input <glb/gltf> --output <glb>');
const input=resolve(args.input),output=resolve(args.output);if(!existsSync(input))throw new Error(`Missing input: ${input}`);
const bin=process.env.GLTFPACK_BIN||'gltfpack';
const command=['-i',input,'-o',output,'-cc','-tc','-kn','-km'];
if(args.textureQuality)command.push('-tq',String(args.textureQuality));
if(args.simplify)command.push('-si',String(args.simplify));
execFileSync(bin,command,{stdio:'inherit'});
if(!existsSync(output)||statSync(output).size<32)throw new Error('gltfpack did not produce a valid output file');
console.log(JSON.stringify({input,output,geometryCompression:'EXT_meshopt_compression',textureCompression:'KTX2',bytes:statSync(output).size}));
