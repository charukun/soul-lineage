#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,re,shutil,struct,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
REV="fc2cd355a8e7c1d8e625fd650abf64f50a1fddaa"; REPO="eturner58/game-assets"
URL="https://github.com/"+REPO+".git"; MAX=20*1024*1024
LIB=ROOT/"apps/review/public/library"
MODEL={
"Fantasy Town Kit":["cart.glb","fence-gate.glb","fountain-round-detail.glb","lantern.glb","road.glb","rock-large.glb","stall-green.glb","stall-red.glb","tree.glb","wall-door.glb","wall-window-shutters.glb","watermill.glb","windmill.glb","stairs-stone.glb"],
"Retro Fantasy Kit":["barrels.glb","detail-crate.glb","fence-wood.glb","ladder.glb","stairs-stone.glb","tower.glb","tree-large.glb","wall-door.glb","wall-window.glb","wood-floor.glb"],
"Mini Dungeon":["barrel.glb","chair.glb","chest.glb","column.glb","gate.glb","pot.glb","potion.glb","stairs.glb","table.glb","trap.glb","weapon-spear.glb","weapon-sword.glb"],
"Mini Forest":["bridge.glb","fence.glb","ladder.glb","plant.glb","rocks-high.glb","target.glb","tent.glb","tree-high.glb","weapon-bow.glb","weapon-arrow.glb"],
"Survival Kit":["barrel.glb","bedroll.glb","bucket.glb","campfire-pit.glb","chest.glb","fence.glb","signpost.glb","tool-axe.glb","tool-hammer.glb","tool-pickaxe.glb","tool-shovel.glb","tree.glb","workbench.glb","workbench-anvil.glb"],
"Graveyard Kit":["bench.glb","candle.glb","coffin.glb","crypt.glb","fence-gate.glb","grave.glb","gravestone-broken.glb","gravestone-decorative.glb","iron-fence.glb","lantern-glass.glb","pine.glb","shovel.glb","stone-wall.glb","urn-round.glb"]}
CAT={"Fantasy Town Kit":"village","Retro Fantasy Kit":"village","Mini Dungeon":"dungeon","Mini Forest":"nature","Survival Kit":"nature","Graveyard Kit":"graveyard"}
ARULE={
"RPG Audio":lambda n:True,
"Impact Sounds":lambda n:any(k in n for k in ("footstep_grass_","footstep_wood_","impactMetal_heavy_","impactMetal_medium_","impactWood_heavy_","impactWood_medium_","impactPunch_heavy_","impactGeneric_light_")),
"Foley Sounds":lambda n:n.startswith(("sword","rockHit","stoneDrag","stoneHit","stonesHit","hitHelmet","woosh","pickup","setDown")),
"UI Audio":lambda n:bool(re.fullmatch(r"click[1-5]\.ogg",n) or re.fullmatch(r"rollover[1-3]\.ogg",n) or re.fullmatch(r"switch[1-8]\.ogg",n))}
ACAT={"RPG Audio":"RPG生活","Impact Sounds":"衝撃","Foley Sounds":"戦闘・物音","UI Audio":"UI"}
def sh(*a,cwd=None): return subprocess.check_output(a,cwd=cwd,text=True).strip()
def ghash(b): return hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()
def h256(b): return hashlib.sha256(b).hexdigest()
def slug(s): return re.sub(r"[^a-z0-9]+","-",s.lower()).strip("-")
def label(s): return " ".join(x.capitalize() for x in re.split(r"[-_]+",Path(s).stem) if x)
def blob(up,p): return sh("git","rev-parse",REV+":"+p,cwd=up)
def data(up,p):
 b=(up/p).read_bytes()
 if ghash(b)!=blob(up,p): raise RuntimeError("blob mismatch "+p)
 return b
def clone(tmp):
 up=tmp/"up"; subprocess.check_call(["git","clone","--filter=blob:none","--no-checkout",URL,str(up)])
 subprocess.check_call(["git","-C",str(up),"checkout",REV,"--","LICENSES.md","kenney/3D assets","kenney/Audio"])
 return up
def model_path(up,pack,name):
 m=[p for p in (up/("kenney/3D assets/"+pack)).rglob(name) if "glb" in str(p.parent).lower()]
 if len(m)!=1: raise RuntimeError(pack+"/"+name)
 return m[0].relative_to(up).as_posix()
def rewrite(up,p,outdir):
 raw=data(up,p)
 if raw[:4]!=b"glTF" or len(raw)>MAX: raise RuntimeError("bad glb "+p)
 _,v,total=struct.unpack_from("<4sII",raw,0)
 if v!=2 or total!=len(raw): raise RuntimeError("bad header "+p)
 chunks=[];o=12;doc=None;ji=None
 while o<len(raw):
  n,t=struct.unpack_from("<II",raw,o);o+=8;q=raw[o:o+n];o+=n
  if t==0x4E4F534A: doc=json.loads(q.rstrip(b" \t\r\n\0").decode());ji=len(chunks)
  chunks.append([t,q])
 if doc is None: raise RuntimeError("no json "+p)
 deps=[];base=Path(p).parent
 for section,folder in (("images","textures"),("buffers","buffers")):
  for e in doc.get(section,[]) or []:
   u=e.get("uri")
   if not u or u.startswith("data:"): continue
   if "://" in u: raise RuntimeError("remote glb uri "+p)
   sp=(base/u).as_posix();b=data(up,sp);sb=blob(up,sp);ext=Path(u).suffix or ".bin"
   rel=folder+"/"+sb+ext;d=outdir/rel;d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes(b);e["uri"]=rel
   deps.append({"sourcePath":sp,"sourceGitBlobSha":sb,"sourceSha256":h256(b),"sourceByteLength":len(b),"runtimeRelativePath":rel,"runtimeGitBlobSha":ghash(b),"runtimeSha256":h256(b),"runtimeByteLength":len(b)})
 jb=json.dumps(doc,separators=(",",":"),ensure_ascii=False).encode();jb+=b" "*((4-len(jb)%4)%4);chunks[ji]=[0x4E4F534A,jb]
 body=bytearray()
 for t,q in chunks:
  if len(q)%4:q+=b"\0"*((4-len(q)%4)%4)
  body+=struct.pack("<II",len(q),t)+q
 return struct.pack("<4sII",b"glTF",2,12+len(body))+body,deps
def common(p,b,s,e): return {"author":"Kenney Vleugels / Kenney","license":"CC0-1.0","licenseUrl":"https://creativecommons.org/publicdomain/zero/1.0/","licenseEvidence":e,"originalSource":"https://kenney.nl/assets","sourceRepository":REPO,"sourceRevision":REV,"sourcePath":p,"sourceGitBlobSha":s,"sourceSha256":h256(b),"sourceByteLength":len(b)}
def generated(objects,sounds):
 j=lambda x:json.dumps(x,ensure_ascii=False,separators=(",",":"))
 (ROOT/"apps/rinne/src/review-curated-assets.generated.js").write_text("\n".join([
 "import {projectAssetUrl} from '@soul/assets';",
 "const env=typeof __BUILD_INFO__==='undefined'?'dev':__BUILD_INFO__.environment;",
 "const active=row=>Object.freeze({...row,url:projectAssetUrl(row.runtimePath,{environment:env})});",
 "const objectRows="+j(objects)+";","const soundRows="+j(sounds)+";",
 "export const RINNE_CURATED_OBJECT_ASSETS=Object.freeze(objectRows.map(active));",
 "export const RINNE_CURATED_SOUND_ASSETS=Object.freeze(soundRows.map(active));",""]),encoding="utf-8")
def patch():
 p=ROOT/"apps/rinne/src/review-object-catalog.js";t=p.read_text()
 t=t.replace("import {defs} from '@soul/world/mura';","import {defs} from '@soul/world/mura';\nimport {RINNE_CURATED_OBJECT_ASSETS} from './review-curated-assets.generated.js';")
 a="  {id:'weapon-great',label:'大剣',category:'weapons',kind:'runtime',runtimeKind:'weapon',weapon:'great',thumbnailUrl:thumb('weapon-great'),source:'RINNE gameplay runtime'},\n]);"
 t=t.replace(a,a[:-4]+"  ...RINNE_CURATED_OBJECT_ASSETS,\n]);");p.write_text(t)
 p=ROOT/"apps/rinne/src/review-sound-catalog.js";t=p.read_text()
 t=t.replace("import {combatSfxURLs} from '@soul/audio/sfx-urls';","import {combatSfxURLs} from '@soul/audio/sfx-urls';\nimport {RINNE_CURATED_SOUND_ASSETS} from './review-curated-assets.generated.js';")
 t=t.replace("  Object.freeze({id:'sfx-slash-b',kind:'sfx',title:'斬撃 B',category:'攻撃',scene:'斬撃・風切り',url:combatSfxURLs.slashB,source:'combatSfxURLs.slashB',description:'斬撃時に交互再生される実ファイルの戦闘SE。'})\n]);","  Object.freeze({id:'sfx-slash-b',kind:'sfx',title:'斬撃 B',category:'攻撃',scene:'斬撃・風切り',url:combatSfxURLs.slashB,source:'combatSfxURLs.slashB',description:'斬撃時に交互再生される実ファイルの戦闘SE。'}),\n  ...RINNE_CURATED_SOUND_ASSETS\n]);");p.write_text(t)
 p=ROOT/"apps/rinne/src/review-object-library.js";t=p.read_text()
 t=t.replace("import {RINNE_OBJECT_REVIEW_CATALOG as OBJECTS} from './review-object-catalog.js';","import {RINNE_OBJECT_REVIEW_CATALOG as OBJECTS} from './review-object-catalog.js';\nimport {createRuntimeThumbnail,scheduleRuntimeThumbnail} from './review-runtime-thumbnail.js';\nimport './review-runtime-thumbnail.css';")
 t=t.replace("const CATEGORY_OPTIONS=Object.freeze([{id:'all',label:'すべて'},{id:'props',label:'小物'},{id:'outdoor',label:'屋外'},{id:'furniture',label:'家具'},{id:'training',label:'訓練'},{id:'weapons',label:'武器'}]);","const CATEGORY_OPTIONS=Object.freeze([{id:'all',label:'すべて'},{id:'village',label:'村・街'},{id:'dungeon',label:'地下'},{id:'nature',label:'自然'},{id:'graveyard',label:'墓地'},{id:'props',label:'小物'},{id:'outdoor',label:'屋外'},{id:'furniture',label:'家具'},{id:'training',label:'訓練'},{id:'weapons',label:'武器'}]);")
 old="""function createObjectThumbnail(item){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('object-thumbnail');svg.setAttribute('viewBox','0 0 160 160');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href',item.thumbnailUrl);svg.append(use);
  return svg;
}"""
 new="""function createObjectThumbnail(item){
  if(item.thumbnailUrl){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('object-thumbnail');svg.setAttribute('viewBox','0 0 160 160');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href',item.thumbnailUrl);svg.append(use);return svg;}
  const canvas=createRuntimeThumbnail(item.label);scheduleRuntimeThumbnail(canvas,'object:'+item.id,async()=>(await loader.loadAsync(new URL(item.url,location.href).href)).scene);return canvas;
}"""
 if old not in t: raise RuntimeError("object thumbnail anchor changed")
 p.write_text(t.replace(old,new))
 p=ROOT/"apps/rinne/tests/review-sound-catalog.test.mjs";t=p.read_text()
 t=t.replace("import {RINNE_SOUND_REVIEW_LIBRARY,filterSoundReviewLibrary,soundReviewCounts} from '../src/review-sound-catalog.js';","import {RINNE_SOUND_REVIEW_LIBRARY,filterSoundReviewLibrary,soundReviewCounts} from '../src/review-sound-catalog.js';\nimport {RINNE_CURATED_SOUND_ASSETS} from '../src/review-curated-assets.generated.js';")
 t=t.replace("  assert.deepEqual(counts,{total:51,bgm:48,sfx:3});\n  assert.equal(new Set(RINNE_SOUND_REVIEW_LIBRARY.map(item=>item.id)).size,51);\n  assert.equal(RINNE_SOUND_REVIEW_LIBRARY.filter(item=>item.kind==='sfx').length,3);","  assert.deepEqual(counts,{total:51+RINNE_CURATED_SOUND_ASSETS.length,bgm:48,sfx:3+RINNE_CURATED_SOUND_ASSETS.length});\n  assert.equal(new Set(RINNE_SOUND_REVIEW_LIBRARY.map(item=>item.id)).size,counts.total);\n  assert.equal(RINNE_SOUND_REVIEW_LIBRARY.filter(item=>item.kind==='sfx').length,3+RINNE_CURATED_SOUND_ASSETS.length);")
 t=t.replace("  assert.equal(filterSoundReviewLibrary({kind:'sfx'}).length,3);","  assert.equal(filterSoundReviewLibrary({kind:'sfx'}).length,3+RINNE_CURATED_SOUND_ASSETS.length);");p.write_text(t)
def testfile():
 (ROOT/"apps/rinne/tests/curated-asset-library.test.mjs").write_text("""import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {RINNE_CURATED_OBJECT_ASSETS as O,RINNE_CURATED_SOUND_ASSETS as S} from '../src/review-curated-assets.generated.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),lib=resolve(root,'apps/review/public/library');const h=b=>createHash('sha256').update(b).digest('hex');const g=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\\\\0')).update(b).digest('hex');
test('curated Kenney assets are self-hosted and provenance-complete',async()=>{const p=JSON.parse(await readFile(resolve(lib,'provenance/kenney-curated-world-audio-v1.json'),'utf8')),m=JSON.parse(await readFile(resolve(lib,'manifest.json'),'utf8')),pm=new Map(p.assets.map(x=>[x.id,x])),mm=new Map(m.files.map(x=>[x.path,x]));assert.ok(O.length>=70);assert.ok(S.length>=150);for(const x of [...O,...S]){assert.match(x.url,/soul-lineage-review-dev\\.c-okamoto\\.workers\\.dev\\/library/);assert.doesNotMatch(x.url,/raw\\.githubusercontent|jsdelivr|codeberg/i);const r=pm.get(x.provenanceId);assert.ok(r);const b=await readFile(resolve(lib,r.runtimePath));assert.equal(b.length,r.runtimeByteLength);assert.equal(h(b),r.runtimeSha256);assert.equal(g(b),r.runtimeGitBlobSha);assert.ok(mm.get(r.runtimePath));if(r.type==='model')assert.equal(b.subarray(0,4).toString(),'glTF');else assert.equal(b.subarray(0,4).toString(),'OggS');}});
test('curated assets are active',async()=>{const [o,s]=await Promise.all([import('../src/review-object-catalog.js'),import('../src/review-sound-catalog.js')]);for(const x of O)assert.ok(o.RINNE_OBJECT_REVIEW_CATALOG.some(y=>y.id===x.id));for(const x of S)assert.ok(s.RINNE_SOUND_REVIEW_LIBRARY.some(y=>y.id===x.id));});
""")
def main():
 with tempfile.TemporaryDirectory() as td:
  up=clone(Path(td));e="https://github.com/"+REPO+"/blob/"+REV+"/LICENSES.md";assets=[];objects=[];sounds=[];rows=[]
  lf=LIB/"licenses/kenney-cc0.txt";lf.parent.mkdir(parents=True,exist_ok=True);lf.write_text("Kenney Vleugels / Kenney\\nCC0-1.0\\nSource "+REPO+"@"+REV+"\\n"+e+"\\n")
  for pack,names in MODEL.items():
   for name in names:
    sp=model_path(up,pack,name);b=data(up,sp);sb=blob(up,sp);aid="kenney-model-"+slug(pack)+"-"+slug(Path(name).stem);od=LIB/"model/kenney"/aid[13:]
    if od.exists():shutil.rmtree(od)
    od.mkdir(parents=True);rb,deps=rewrite(up,sp,od);rh=ghash(rb);dest=od/(rh+".glb");dest.write_bytes(rb);rp=dest.relative_to(LIB).as_posix()
    assets.append({"id":aid,"type":"model","pack":pack,**common(sp,b,sb,e),"runtimePath":rp,"runtimeGitBlobSha":rh,"runtimeSha256":h256(rb),"runtimeByteLength":len(rb),"dependencies":deps});objects.append({"id":aid,"label":pack+" · "+label(name),"category":CAT[pack],"kind":"gltf","runtimePath":rp,"source":"Kenney "+pack+" · CC0","provenanceId":aid});rows.append({"path":rp,"bytes":len(rb),"gitBlobSha":rh,"sha256":h256(rb),"kind":"model","sourceRevision":REV})
    for d in deps:
     q=(od/d["runtimeRelativePath"]).relative_to(LIB).as_posix();rows.append({"path":q,"bytes":d["runtimeByteLength"],"gitBlobSha":d["runtimeGitBlobSha"],"sha256":d["runtimeSha256"],"kind":"texture","sourceRevision":REV})
  for pack,rule in ARULE.items():
   for f in sorted((up/("kenney/Audio/"+pack)).rglob("*.ogg")):
    if not rule(f.name):continue
    sp=f.relative_to(up).as_posix();b=data(up,sp);sb=blob(up,sp)
    if b[:4]!=b"OggS" or len(b)>MAX:raise RuntimeError("bad ogg "+sp)
    aid="kenney-audio-"+slug(pack)+"-"+slug(f.stem);rp="audio/kenney/"+slug(pack)+"/"+sb+".ogg";o=LIB/rp;o.parent.mkdir(parents=True,exist_ok=True);o.write_bytes(b)
    assets.append({"id":aid,"type":"audio","pack":pack,**common(sp,b,sb,e),"runtimePath":rp,"runtimeGitBlobSha":sb,"runtimeSha256":h256(b),"runtimeByteLength":len(b),"dependencies":[]});sounds.append({"id":aid,"kind":"sfx","title":label(f.name),"category":ACAT[pack],"scene":ACAT[pack],"runtimePath":rp,"source":"Kenney "+pack+" · CC0","description":"Kenney CC0 self-hosted source audio.","provenanceId":aid});rows.append({"path":rp,"bytes":len(b),"gitBlobSha":sb,"sha256":h256(b),"kind":"audio","sourceRevision":REV})
  prov={"schema":1,"collection":"kenney-curated-world-audio-v1","sourceRepository":REPO,"sourceRevision":REV,"author":"Kenney Vleugels / Kenney","license":"CC0-1.0","licenseUrl":"https://creativecommons.org/publicdomain/zero/1.0/","licenseEvidence":e,"originalSource":"https://kenney.nl/assets","assetCount":len(assets),"objectCount":len(objects),"soundCount":len(sounds),"assets":assets};pf=LIB/"provenance/kenney-curated-world-audio-v1.json";pf.parent.mkdir(parents=True,exist_ok=True);pf.write_text(json.dumps(prov,ensure_ascii=False,indent=2)+"\\n")
  for f,k in ((lf,"license"),(pf,"provenance")):
   b=f.read_bytes();rows.append({"path":f.relative_to(LIB).as_posix(),"bytes":len(b),"gitBlobSha":ghash(b),"sha256":h256(b),"kind":k,"sourceRevision":REV})
  mf=LIB/"manifest.json";m=json.loads(mf.read_text());m["files"]=sorted(m["files"]+rows,key=lambda x:x["path"]);mf.write_text(json.dumps(m,ensure_ascii=False,indent=2)+"\\n")
  generated(objects,sounds);patch();testfile()
  d=ROOT/"docs/ASSET_ORIGIN.md";t=d.read_text();t=t.replace("- Demon: five pinned Gobkit model surfaces.","- Demon: five pinned Gobkit model surfaces.\\n- RINNE curated Kenney CC0 library: "+str(len(objects))+" object models and "+str(len(sounds))+" sounds, pinned to "+REPO+"@"+REV+" with source/runtime hashes and byte lengths.");d.write_text(t)
  if len(objects)<70 or len(sounds)<150:raise RuntimeError("curation too small")
  for r in rows:
   b=(LIB/r["path"]).read_bytes()
   if len(b)!=r["bytes"] or h256(b)!=r["sha256"] or ghash(b)!=r["gitBlobSha"] or len(b)>MAX:raise RuntimeError("verification "+r["path"])
  print(json.dumps({"objects":len(objects),"sounds":len(sounds),"files":len(rows)}))
if __name__=="__main__":main()
