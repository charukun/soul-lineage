import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const COLLECTION_ID='rinne-three-worlds-150-v2';
const ID=/^(?:r|v|d)\d{2}$|^s\d{2}$/;
const SHA=/^[a-f0-9]{64}$/;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const requireValue=(ok,message)=>{if(!ok)throw new Error(message);};

export function readStudioCatalog(html){
 const matches=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter(m=>/(?:^|\s)id\s*=\s*(["'])catalogData\1/i.test(m[1]));
 requireValue(matches.length===1,'Expected exactly one script#catalogData');
 const catalog=JSON.parse(matches[0][2]);
 requireValue(catalog?.collectionId===COLLECTION_ID,'Wrong collection');
 requireValue(Array.isArray(catalog.tracks)&&catalog.tracks.length===150,'Expected 150 tracks');
 const ids=new Set();
 for(const track of catalog.tracks){
  requireValue(ID.test(track?.id||'')&&!ids.has(track.id),`Invalid or duplicate track id: ${track?.id}`);ids.add(track.id);
  requireValue(typeof track.midiBase64==='string'&&track.midiBase64.length>16,`${track.id}: embedded MIDI missing`);
  const midi=Buffer.from(track.midiBase64,'base64');
  requireValue(midi.subarray(0,4).toString('ascii')==='MThd',`${track.id}: invalid MIDI header`);
  if(track.midiSha256){requireValue(SHA.test(track.midiSha256)&&sha256(midi)===track.midiSha256,`${track.id}: MIDI digest mismatch`);}
 }
 return catalog;
}

export function verifyMitLicense(text){
 requireValue(/MIT License/i.test(text),'SoundFont evidence must identify the MIT License');
 requireValue(/permission is hereby granted, free of charge/i.test(text),'MIT permission grant missing');
 requireValue(/copyright notice and this permission notice/i.test(text),'MIT notice-retention clause missing');
 return true;
}

function run(command,args){execFileSync(command,args,{stdio:'inherit'});}
function probe(path){
 const text=execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',path],{encoding:'utf8'}).trim();
 const duration=Number(text);requireValue(Number.isFinite(duration)&&duration>1,`Bad rendered duration: ${path}`);return duration;
}

export function rerender({studio,soundfont,license,sampleSources,currentCatalog,output}){
 for(const path of [studio,soundfont,license,currentCatalog])requireValue(path&&existsSync(path),`Missing input: ${path}`);
 requireValue(output&&!existsSync(output),'Output must be a new directory');
 const licenseText=readFileSync(license,'utf8');verifyMitLicense(licenseText);
 const sourceHtml=readFileSync(studio,'utf8');
 const source=readStudioCatalog(sourceHtml);
 const current=JSON.parse(readFileSync(currentCatalog,'utf8'));
 requireValue(Array.isArray(current)&&current.length===150,'Current runtime catalog must contain 150 tracks');
 const currentById=new Map(current.map(t=>[t.id,t]));
 requireValue(currentById.size===150,'Runtime catalog contains duplicate IDs');
 const stage=mkdtempSync(resolve(dirname(resolve(output)),'.bgm150-mit-'));
 try{
  const audioDir=resolve(stage,'audio'),midiDir=resolve(stage,'midi'),evidenceDir=resolve(stage,'licenses');
  mkdirSync(audioDir,{recursive:true});mkdirSync(midiDir,{recursive:true});mkdirSync(evidenceDir,{recursive:true});
  const results=[];
  for(const track of source.tracks){
   requireValue(currentById.has(track.id),`${track.id}: missing from runtime catalog`);
   const midi=Buffer.from(track.midiBase64,'base64');
   const midiPath=resolve(midiDir,`${track.id}.mid`),wavPath=resolve(stage,`${track.id}.wav`),oggPath=resolve(audioDir,`${track.id}.ogg`);
   writeFileSync(midiPath,midi);
   run('fluidsynth',['-ni','-F',wavPath,'-r','44100',soundfont,midiPath]);
   run('ffmpeg',['-nostdin','-y','-loglevel','error','-i',wavPath,'-c:a','libvorbis','-q:a','5',oggPath]);
   rmSync(wavPath,{force:true});
   const ogg=readFileSync(oggPath);requireValue(ogg.subarray(0,4).toString('ascii')==='OggS',`${track.id}: Ogg header missing`);
   results.push({id:track.id,sha256:sha256(ogg),duration:probe(ogg),sizeBytes:ogg.length,midiSha256:sha256(midi)});
  }
  requireValue(results.length===150&&new Set(results.map(r=>r.sha256)).size===150,'Expected 150 distinct rendered Ogg files');
  const resultById=new Map(results.map(r=>[r.id,r]));
  const catalog=current.map(track=>({...track,sha256:resultById.get(track.id).sha256,productionStatus:'release-candidate',commercialClearance:true,licenseStatus:'MIT-notice-required'}));
  writeFileSync(resolve(stage,'catalog.json'),`${JSON.stringify(catalog,null,2)}\n`);
  writeFileSync(resolve(evidenceDir,'MuseScore_General_License.md'),licenseText);
  if(sampleSources&&existsSync(sampleSources))writeFileSync(resolve(evidenceDir,'MuseScore_General_Sample_Sources.csv'),readFileSync(sampleSources));
  const manifest={schemaVersion:1,collectionId:COLLECTION_ID,renderer:'FluidSynth',soundfont:{file:soundfont,sha256:sha256(readFileSync(soundfont)),license:'MIT',licenseNoticeRequired:true},tracks:results,commercialClearance:true,clearanceBasis:'Original embedded MIDI + MuseScore_General MIT SoundFont; retain MIT copyright/license notice in associated documentation.'};
  writeFileSync(resolve(stage,'rerender-manifest.json'),`${JSON.stringify(manifest,null,2)}\n`);
  writeFileSync(resolve(stage,'README.md'),`# 三界の調べ / MIT rerender\n\n150曲を元の埋め込みMIDIから再レンダリングした候補出力です。MuseScore_General SoundFont のMIT著作権・許諾表示を配布物の関連ドキュメントに保持してください。\n`);
  mkdirSync(dirname(resolve(output)),{recursive:true});
  requireValue(!existsSync(output),'Output appeared while rendering');
  const {renameSync}=await import('node:fs');renameSync(stage,output);
  return manifest;
 }catch(error){rmSync(stage,{recursive:true,force:true});throw error;}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const {values}=parseArgs({options:{studio:{type:'string'},soundfont:{type:'string'},license:{type:'string'},sampleSources:{type:'string'},currentCatalog:{type:'string'},output:{type:'string'}}});
  for(const key of ['studio','soundfont','license','currentCatalog','output'])requireValue(values[key],`Missing --${key}`);
  await rerender(values);
 }catch(error){console.error(`BGM150 MIT rerender failed: ${error.message}`);process.exitCode=1;}
}
