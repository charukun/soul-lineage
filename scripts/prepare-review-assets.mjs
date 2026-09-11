import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { REVIEW_DOWNLOADS, REVIEW_ASSET_REVISION, REVIEW_MOTION_FAMILIES, SHINO_REVIEW, sourceUrl } from '../packages/assets/src/review-catalog.js';
export function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
export function verifyBytes(row, bytes) {
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw new Error(`Invalid asset byte count: ${row.id}`);
  if (row.size !== null && row.size !== undefined && row.size !== bytes.length) throw new Error(`Asset size mismatch: ${row.id}: ${bytes.length}/${row.size}`);
  if (bytes.subarray(0,80).toString().includes('git-lfs.github.com/spec')) throw new Error(`LFS pointer is not an asset: ${row.id}`);
  if (row.gitBlob) {
    const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (hash !== row.gitBlob) throw new Error(`Git blob hash mismatch: ${row.id}`);
  }
  const sha256 = digest(bytes);
  if (row.sha256 && row.sha256 !== sha256) throw new Error(`SHA-256 mismatch: ${row.id}`);
  return sha256;
}
export function parseGlb(bytes) {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid GLB header');
  let offset = 12, json;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error('Truncated GLB chunk');
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4); offset += 8;
    if (length % 4 || offset + length > bytes.length) throw new Error('Invalid GLB chunk length');
    if (type === 0x4e4f534a) { if (json || offset !== 20) throw new Error('Invalid GLB JSON order'); json = JSON.parse(bytes.subarray(offset,offset+length).toString('utf8')); }
    offset += length;
  }
  if (!json || json.asset?.version !== '2.0') throw new Error('Missing glTF 2.0 document');
  return json;
}
export function safeOutput(root,path) {
  if (typeof path !== 'string' || !/^[\w./-]+$/.test(path) || path.startsWith('/') || path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe asset output path');
  return resolve(root,path);
}
async function download(row) {
  const url = sourceUrl(row);
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url,{signal:AbortSignal.timeout(30_000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${row.id}`);
      const chunks = []; let length = 0;
      for await (const chunk of response.body) {
        length += chunk.length;
        if (length > (row.size || 25 * 1024 * 1024)) throw new Error(`Oversized download: ${row.id}`);
        chunks.push(Buffer.from(chunk));
      }
      const bytes = Buffer.concat(chunks); verifyBytes(row,bytes); return bytes;
    } catch (error) { last = error; }
  }
  throw last;
}
export async function prepareReviewAssets() {
  const root = await mkdtemp(join(tmpdir(),'rinne-review-assets-'));
  try {
    const shino = await readFile(SHINO_REVIEW.repositoryPath); verifyBytes(SHINO_REVIEW,shino);
    const document = parseGlb(shino), meta = document.extensions?.VRMC_vrm?.meta;
    if (document.extensions?.VRMC_vrm?.specVersion !== '1.0' || meta?.name !== 'Sendagaya_Shino' || meta.allowRedistribution !== true || meta.modification !== 'allowModificationRedistribution') throw new Error('Shino identity or redistribution metadata mismatch');
    const files = [];
    // A small bounded queue: never download every candidate in the original catalogue.
    for (let start = 0; start < REVIEW_DOWNLOADS.length; start += 3) {
      const rows = REVIEW_DOWNLOADS.slice(start,start+3);
      const settled = await Promise.allSettled(rows.map(async row => {
        const bytes = await download(row), output = safeOutput(root,row.output);
        await mkdir(dirname(output),{recursive:true}); await writeFile(output,bytes);
        return {...row,sha256:digest(bytes),size:bytes.length,url:sourceUrl(row)};
      }));
      const failure = settled.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
      files.push(...settled.map(result => result.value));
    }
    const library = parseGlb(await readFile(join(root,'AnimationLibrary.glb')));
    if ([...(library.buffers || []),...(library.images || [])].some(row => row.uri)) throw new Error('Animation GLB unexpectedly requires external resources');
    const names = (library.animations || []).map(clip => clip.name);
    for (const name of ['A_TPose','Idle_Loop','Walk_Loop','Jog_Fwd_Loop']) if (!names.includes(name)) throw new Error(`Pinned animation is missing: ${name}`);
    const weapon = JSON.parse(await readFile(join(root,'weapon/sword_2handed.gltf'),'utf8'));
    const resources = [...(weapon.buffers || []),...(weapon.images || [])].map(row => row.uri);
    if (resources.length !== 2 || !resources.includes('sword_2handed.bin') || !resources.includes('knight_texture.png')) throw new Error('Unexpected sword dependencies');
    const families = REVIEW_MOTION_FAMILIES.map(row => ({id:row.id,label:row.label,clips:names.filter(name => new RegExp(row.pattern,'i').test(name))}));
    const manifest = {revision:REVIEW_ASSET_REVISION,buildCommit:process.env.GITHUB_SHA || execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
      status:'visual-approval-pending',shino:SHINO_REVIEW,files,animationNames:names,families,
      limitations:['No automatic gameplay replacement','No foot IK approval','Weapon socket requires visual fitting','Preview marker is not a confirmed gameplay hit','No new sound source installed']};
    await writeFile(join(root,'manifest.json'),JSON.stringify(manifest,null,2));
    await writeFile(join(root,'CREDITS.txt'),[
      'Lanternfell asset review candidates. Visual approval pending.',
      'Shino: exact existing SHINO_review.vrm; VRoid Project / pixiv Inc.; Coatie (coati) conversion.',
      SHINO_REVIEW.originalTerms,SHINO_REVIEW.conversionTerms,'https://vrm.dev/licenses/1.0/',
      'Quaternius: Universal Animation Library, CC0. Pinned bundled subset, not a claim of latest/full Pro release.',
      'https://quaternius.com/packs/universalanimationlibrary.html',
      'norio rest-space retarget approach adapted for raw VRM 1 bones; MIT copyright/license retained in licenses/norio-MIT.txt.',
      'Kenney: Particle Pack, CC0; sprite composition and timing modified in the renderer.',
      'Kay Lousberg: KayKit Adventurers sword, CC0; original geometry/texture, preview scale 0.5; socket unapproved.',
      'All source URLs, pinned revisions and resulting SHA-256 values: manifest.json.',
    ].join('\n')+'\n');
    console.log('REVIEW_ASSET_INVENTORY '+JSON.stringify({files:files.length,bytes:files.reduce((n,row)=>n+row.size,0),families}));
    return {root,manifest};
  } catch (error) { await rm(root,{recursive:true,force:true}); throw error; }
}
