import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const packageRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=new Map();
for(let i=2;i<process.argv.length;i+=2) args.set(process.argv[i],process.argv[i+1]);
const required=['--soundfont','--license','--sample-sources','--soundfont-url','--license-url','--sample-sources-url','--source-package'];
for(const key of required){if(!args.get(key)) throw new Error(`missing ${key}`);}
const soundfont=resolve(args.get('--soundfont'));
const licensePath=resolve(args.get('--license'));
const sampleSourcesPath=resolve(args.get('--sample-sources'));
const catalogPath=join(packageRoot,'src','catalog.json');
const manifestPath=join(packageRoot,'sources','midi-manifest.json');
const audioDir=join(packageRoot,'assets','audio');
const provenancePath=join(packageRoot,'sources','render-provenance.json');
const sha256=buffer=>createHash('sha256').update(buffer).digest('hex');
const command=(bin,argv,{quiet=false}={})=>{
  const run=spawnSync(bin,argv,{encoding:'utf8',stdio:quiet?['ignore','pipe','pipe']:['ignore','pipe','pipe'],maxBuffer:16*1024*1024});
  if(run.error) throw run.error;
  if(run.status!==0) throw new Error(`${bin} failed (${run.status})\n${run.stderr||run.stdout}`);
  return (run.stdout||'').trim();
};
for(const bin of ['fluidsynth','ffmpeg','ffprobe']) command(bin,[bin==='fluidsynth'?'-V':'-version'],{quiet:true});
const licenseText=await readFile(licensePath,'utf8');
if(!/Permission is hereby granted/i.test(licenseText)||!/(MIT|licen[cs]e)/i.test(licenseText)) throw new Error('SoundFont license evidence does not contain the expected permissive MIT terms');
const sampleSourcesText=await readFile(sampleSourcesPath,'utf8');
if(sampleSourcesText.trim().length<64) throw new Error('SoundFont sample-source evidence is unexpectedly empty');
const sfBytes=await readFile(soundfont);
const soundfontSha256=sha256(sfBytes);
const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
if(manifest.collectionId!=='rinne-three-worlds-150-v2') throw new Error(`unexpected collectionId ${manifest.collectionId}`);
if(catalog.length!==150||manifest.tracks.length!==150) throw new Error(`expected 150 tracks, got catalog=${catalog.length} manifest=${manifest.tracks.length}`);
const manifestById=new Map(manifest.tracks.map(track=>[track.id,track]));
if(manifestById.size!==150) throw new Error('duplicate MIDI ids in manifest');
for(const track of catalog){
  const source=manifestById.get(track.id);
  if(!source) throw new Error(`missing MIDI manifest entry ${track.id}`);
  const midi=await readFile(join(packageRoot,'sources','midi',`${track.id}.mid`));
  const actual=sha256(midi);
  if(actual!==source.sha256) throw new Error(`MIDI SHA mismatch ${track.id}: ${actual} != ${source.sha256}`);
}
await mkdir(audioDir,{recursive:true});
const work=await mkdtemp(join(tmpdir(),'bgm150-clearance-'));
const rendered=[];
try{
  for(const [index,track] of catalog.entries()){
    const midi=join(packageRoot,'sources','midi',`${track.id}.mid`);
    const wav=join(work,`${track.id}.wav`);
    const ogg=join(audioDir,`${track.id}.ogg`);
    command('fluidsynth',['-ni','-g','0.65','-F',wav,'-r','44100',soundfont,midi],{quiet:true});
    command('ffmpeg',['-y','-v','error','-i',wav,'-af','apad','-t',String(track.duration),'-map_metadata','-1','-c:a','libvorbis','-q:a','3',ogg],{quiet:true});
    const oggBytes=await readFile(ogg);
    if(oggBytes.subarray(0,4).toString()!=='OggS') throw new Error(`invalid Ogg header ${track.id}`);
    const duration=Number(command('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',ogg],{quiet:true}));
    if(!Number.isFinite(duration)||Math.abs(duration-track.duration)>0.20) throw new Error(`duration mismatch ${track.id}: ${duration} vs ${track.duration}`);
    const source=manifestById.get(track.id);
    const oggSha256=sha256(oggBytes);
    Object.assign(track,{
      sha256:oggSha256,
      sourceMidiSha256:source.sha256,
      productionStatus:'production',
      commercialClearance:true,
      licenseStatus:'cleared-mit-render',
      renderSource:'MuseScore_General_Lite',
      renderLicense:'MIT',
      renderSourceSha256:soundfontSha256
    });
    rendered.push({id:track.id,midiSha256:source.sha256,oggSha256,duration,bytes:oggBytes.length});
    await rm(wav,{force:true});
    process.stdout.write(`[${index+1}/150] ${track.id}\n`);
  }
}finally{await rm(work,{recursive:true,force:true});}
if(new Set(rendered.map(x=>x.oggSha256)).size!==150) throw new Error('rendered Ogg hashes are not unique');
await writeFile(catalogPath,`${JSON.stringify(catalog,null,2)}\n`,'utf8');
const provenance={
  schemaVersion:1,
  collectionId:manifest.collectionId,
  sourceStudio:{name:manifest.sourceStudio?.name??'Rinne_BGM_150_Studio.html',sha256:manifest.sourceStudio?.sha256??null},
  sourceMidiManifestSha256:sha256(await readFile(manifestPath)),
  renderer:{engine:'FluidSynth',sampleRate:44100,gain:0.65,codec:'libvorbis',quality:3,durationPolicy:'catalog trim/pad'},
  soundfont:{name:'MuseScore_General_Lite.sf3',sourcePackage:args.get('--source-package'),url:args.get('--soundfont-url'),sha256:soundfontSha256,license:'MIT',licenseUrl:args.get('--license-url'),sampleSourcesUrl:args.get('--sample-sources-url')},
  generatedAt:new Date().toISOString(),
  tracks:rendered
};
await writeFile(provenancePath,`${JSON.stringify(provenance,null,2)}\n`,'utf8');
console.log(`rendered ${rendered.length} tracks; soundfont sha256=${soundfontSha256}`);
