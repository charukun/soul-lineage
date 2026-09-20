#!/usr/bin/env node
// Explicit, offline media intake. Never runs in app build, install, or CI lifecycle.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,copyFileSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateTitleManifest} from '../src/title-cinematic-media.js';
const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1];
if(!args.includes('--input')||!args.includes('--revision')||!args.includes('--provider'))throw Error('Usage: node apps/rinne/scripts/import-title-movie.mjs --input /path/master.mp4 --revision film-r2 --provider Seedance [--loop] [--webm]');
const revision=arg('--revision');if(!/^[a-zA-Z0-9_-]+$/.test(revision))throw Error('Use a filesystem-safe revision');
const input=resolve(arg('--input')),out=resolve(dirname(fileURLToPath(import.meta.url)),'../public/title-assets/cinematic');
const probe=file=>JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8'}));
const original=probe(input),source=original.streams.find(s=>s.codec_type==='video');
if(!source||Number(original.format.duration)<6)throw Error('The approved master must contain at least six seconds');
const hasLoop=args.includes('--loop'),duration=hasLoop?8:6;
if(Number(original.format.duration)<duration)throw Error('Living-loop master requires six seconds of story plus two seconds of matching tail');
const tmp=mkdtempSync(join(tmpdir(),'rinne-film-'));
try{
  const movie=`opening-${revision}.mp4`,webm=`opening-${revision}.webm`,poster=`landing-${revision}.webp`;
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',input,'-t',String(duration),'-vf','scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=24','-c:v','libx264','-preset','slow','-crf','23','-pix_fmt','yuv420p','-profile:v','high','-movflags','+faststart','-c:a','aac','-b:a','128k',join(tmp,movie)]);
  const encoded=probe(join(tmp,movie)),v=encoded.streams.find(s=>s.codec_type==='video');
  const bytes=statSync(join(tmp,movie)).size;if(bytes>8*1024*1024)throw Error('Web MP4 exceeds 8 MiB; adjust the master or encoder quality and inspect again');
  const landing=hasLoop?6:6-1/24;
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-ss',String(landing),'-i',join(tmp,movie),'-frames:v','1','-c:v','libwebp','-quality','86',join(tmp,poster)]);
  if(args.includes('--webm')){
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',join(tmp,movie),'-c:v','libvpx-vp9','-b:v','0','-crf','34','-c:a','libopus','-b:a','96k',join(tmp,webm)]);
    if(statSync(join(tmp,webm)).size>8*1024*1024)throw Error('WebM exceeds budget');
  }
  const manifest=validateTitleManifest({schemaVersion:1,status:'ready',revision,movie:`./title-assets/cinematic/${movie}`,webm:args.includes('--webm')?`./title-assets/cinematic/${webm}`:null,poster:`./title-assets/cinematic/${poster}`,width:v.width,height:v.height,fps:24,duration:Number(v.duration??encoded.format.duration),titleLandingTime:6,firstVisitSkipTime:1.8,returnVisitSkipTime:0,livingLoop:hasLoop?{start:6,end:8}:null,maxWebBytes:8388608,audio:{autoplayMuted:true},provenance:'PROVENANCE.json'});
  const provenance={provider:arg('--provider'),revision,sourceSha256:createHash('sha256').update(readFileSync(input)).digest('hex'),encodedSha256:createHash('sha256').update(readFileSync(join(tmp,movie))).digest('hex'),encodedBytes:bytes,createdAt:new Date().toISOString(),review:'Human/agent visual approval required before committing. Intake does not certify character, motion, loop or rights quality.'};
  for(const name of [movie,poster,...(args.includes('--webm')?[webm]:[])])copyFileSync(join(tmp,name),join(out,name));
  writeFileSync(join(out,'PROVENANCE.json'),JSON.stringify(provenance,null,2)+'\n');
  writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(`Prepared ${movie}: ${bytes} bytes. Inspect all six seconds, the landing poster and the 8→6 loop before committing.`);
}finally{rmSync(tmp,{recursive:true,force:true});}
