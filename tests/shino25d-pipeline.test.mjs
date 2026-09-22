import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {createShinoDraft,assertSprite25dManifest,DIRECTIONS,ACTIONS,LIMITS,resolveSprite25dFrame,sprite25dCoverage,pruneSprite25dAssets} from '../packages/assets/src/sprite25d-manifest.js';
import {spriteAssetBlob,verifySprite25dBundle,readSprite25dFile,validateSprite25dAtlas} from '../packages/assets/src/adapters/browser/sprite25d-assets.js';
import {createSprite25dActor} from '../packages/assets/src/adapters/three/sprite25d-actor.js';
import {shino25dGuestEnabled} from '../apps/rinne/src/rebuild/shino25d-guest-policy.js';

// Synthetic raster fixtures only. These are not Shino art or visual-approval evidence.
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([size,name,data,crc]);}
function png(width=16,height=16){const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;const pixels=Buffer.alloc((width*4+1)*height,255);for(let y=0;y<height;y++)pixels[y*(width*4+1)]=0;pixels[4]=0;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);}
function asset(width=16,height=16){const bytes=png(width,height),sha256=createHash('sha256').update(bytes).digest('hex');return{sha256,byteLength:bytes.length,width,height,mediaType:'image/png',name:'synthetic-fixture.png',hasTransparency:true,dataUrl:`data:image/png;base64,${bytes.toString('base64')}`,provenance:{kind:'user-upload',author:'user-supplied-unverified',license:'unverified'}};}
function poseDraft(){const draft=createShinoDraft(),image=asset();draft.assets[image.sha256]=image;draft.references.front=image.sha256;draft.pose=image.sha256;return draft;}
function atlasDraft(){const draft=poseDraft(),image=asset(32,128);draft.assets[image.sha256]=image;for(const [row,direction] of DIRECTIONS.entries())draft.animations.walk[direction]={asset:image.sha256,columns:2,rows:8,row,fps:10};return draft;}

test('empty draft has all reference/action slots and never fabricates art',()=>{
 const d=createShinoDraft();assert.equal(assertSprite25dManifest(d),d);assert.deepEqual(Object.keys(d.references),['sheet','front','quarter','side','back']);
 assert.deepEqual(sprite25dCoverage(d),{idle:0,walk:0});for(const action of ACTIONS)for(const direction of DIRECTIONS)assert.equal(resolveSprite25dFrame(d,action,direction),null);
 assert.equal(d.review.productionApproved,false);assert.equal(d.model3d,null);
});
test('reference and alpha are required, and missing Walk stays a labelled static fallback',()=>{
 const d=poseDraft();assertSprite25dManifest(d);assert.equal(resolveSprite25dFrame(d,'walk','n').fallback,true);assert.deepEqual(sprite25dCoverage(d),{idle:0,walk:0});
 d.references.front=null;assert.throws(()=>assertSprite25dManifest(d),/基準画/);d.references.front=d.pose;d.assets[d.pose].hasTransparency=false;assert.throws(()=>assertSprite25dManifest(d),/透明/);
});
test('eight directional atlas rows are explicit; wrong layout or rate fails closed',()=>{
 const d=atlasDraft();assertSprite25dManifest(d);assert.equal(sprite25dCoverage(d).walk,8);assert.equal(resolveSprite25dFrame(d,'walk','n').row,4);
 for(const change of [{row:0},{columns:3},{rows:7},{fps:25}]){const bad=structuredClone(d);Object.assign(bad.animations.walk.n,change);assert.throws(()=>assertSprite25dManifest(bad));}
 const partial=structuredClone(d);partial.animations.walk.n=null;assert.equal(sprite25dCoverage(partial).walk,7);assert.equal(resolveSprite25dFrame(partial,'walk','n').fallback,true);
});
test('size, pivot, approval and external URL metadata cannot bypass the draft gate',()=>{
 for(const mutate of [d=>d.assets[d.pose].dataUrl='https://example.invalid/image.png',d=>d.assets[d.pose].byteLength++,d=>d.render.pivot[0]=NaN,d=>d.render.height=50,d=>d.review.productionApproved=true,d=>d.model3d={url:'x'},d=>d.assets[d.pose].width=LIMITS.edge+1]){const d=poseDraft();mutate(d);assert.throws(()=>assertSprite25dManifest(d));}
 assert.throws(()=>spriteAssetBlob({mediaType:'image/png',dataUrl:'data:image/png;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')}),/実体/);
});
test('crop lineage must be acyclic and match dimensions; pruning preserves its source',()=>{
 const d=poseDraft(),parent=asset(32,32),unused=asset(8,8);d.assets[parent.sha256]=parent;d.assets[unused.sha256]=unused;
 d.assets[d.pose].provenance={...d.assets[d.pose].provenance,kind:'reference-crop',parentSha256:parent.sha256,rect:[0,0,16,16],removeBorderWhite:false};
 assertSprite25dManifest(d);pruneSprite25dAssets(d);assert.ok(d.assets[parent.sha256]);assert.equal(d.assets[unused.sha256],undefined);
 d.assets[d.pose].provenance.parentSha256=d.pose;assert.throws(()=>assertSprite25dManifest(d),/循環/);
 d.assets[d.pose].provenance.parentSha256=parent.sha256;d.assets[d.pose].provenance.rect[2]=12;assert.throws(()=>assertSprite25dManifest(d),/範囲/);
});
test('guest requires an explicit DEV/local opt-in and rejects Production or missing build info',()=>{
 for(const environment of ['dev','local']){assert.equal(shino25dGuestEnabled('?character25d=shino',environment),true);assert.equal(shino25dGuestEnabled('',environment),false);}
 for(const environment of ['prod','production','preview',undefined,null,''])assert.equal(shino25dGuestEnabled('?character25d=shino',environment),false);
});

function browserPorts(t,{blank=false}={}){
 const previous={Image:globalThis.Image,document:globalThis.document,create:URL.createObjectURL,revoke:URL.revokeObjectURL},urls=new Map();let count=0;
 URL.createObjectURL=blob=>{const url=`blob:fixture-${++count}`;urls.set(url,blob);return url;};URL.revokeObjectURL=url=>urls.delete(url);
 globalThis.Image=class{set src(url){void urls.get(url).arrayBuffer().then(buffer=>{const bytes=Buffer.from(buffer);this.naturalWidth=this.width=bytes.readUInt32BE(16);this.naturalHeight=this.height=bytes.readUInt32BE(20);this.onload();});}};
 globalThis.document={createElement(tag){assert.equal(tag,'canvas');return{width:1,height:1,getContext(){return{drawImage(){},getImageData(x,y,w,h){const data=new Uint8ClampedArray(w*h*4);if(!blank)data.fill(255);data[3]=0;return{data};}};}};}};
 t.after(()=>{globalThis.Image=previous.Image;globalThis.document=previous.document;URL.createObjectURL=previous.create;URL.revokeObjectURL=previous.revoke;});return{urls};
}
test('bundle import verifies hash, byte length and decoded metadata before preview',async t=>{
 const ports=browserPorts(t),d=poseDraft(),accepted=await verifySprite25dBundle(d);assert.deepEqual(accepted,d);assert.notEqual(accepted,d);assert.equal(ports.urls.size,0);
 const bad=structuredClone(d),old=bad.pose,newHash='a'.repeat(64);bad.assets[newHash]={...bad.assets[old],sha256:newHash};delete bad.assets[old];bad.pose=bad.references.front=newHash;await assert.rejects(verifySprite25dBundle(bad),/hash/);
 const dimensions=structuredClone(d);dimensions.assets[d.pose].width=17;await assert.rejects(verifySprite25dBundle(dimensions),/実寸/);
 const file=new Blob([JSON.stringify(d)]);assert.deepEqual(await readSprite25dFile(file),d);await assert.rejects(readSprite25dFile(new Blob(['not-json'])),/JSON/);
});
test('atlas import rejects empty cells instead of reporting eight completed directions',async t=>{browserPorts(t,{blank:true});await assert.rejects(validateSprite25dAtlas(asset(32,128),2),/空の方向/);});

class Vector{constructor(){this.x=0;this.y=0;this.z=0;}set(x,y,z=0){Object.assign(this,{x,y,z});return this;}}
class Object3d{constructor(){this.position=new Vector();this.scale=new Vector();this.rotation=new Vector();this.children=[];this.visible=true;}add(child){this.children.push(child);child.parent=this;}getWorldPosition(out){return out.set(this.position.x,this.position.y,this.position.z);}removeFromParent(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}}
class Disposable{dispose(){this.disposed=true;}}
const three={Group:Object3d,Vector3:Vector,Mesh:class extends Object3d{constructor(geometry,material){super();this.geometry=geometry;this.material=material;}},PlaneGeometry:Disposable,CircleGeometry:Disposable,MeshBasicMaterial:class extends Disposable{constructor(options){super();Object.assign(this,options);}},Texture:class extends Disposable{constructor(image){super();this.image=image;this.repeat=new Vector();this.offset=new Vector();}},SRGBColorSpace:'srgb',LinearFilter:'linear',DoubleSide:2};
test('shared actor selects UV rows/frames, preserves feet and disposes owned resources',async t=>{
 browserPorts(t);const d=atlasDraft(),actor=await createSprite25dActor(three,d,{shadow:true}),camera={position:{x:0,z:5}};actor.setPreview('walk','n');actor.update({camera,delta:0});
 const mesh=actor.object.children[0],texture=mesh.material.map;assert.equal(mesh.position.y,d.render.height/2);assert.equal(texture.repeat.x,15/32);assert.equal(texture.offset.y,1-(5*16-.5)/128);
 actor.update({camera,delta:.1});assert.equal(texture.offset.x,16.5/32);actor.setPreview('idle','s');actor.update({camera});assert.match(actor.getStatus(),/静止画/);
 const poseTexture=mesh.material.map;actor.dispose();actor.dispose();assert.equal(texture.disposed,true);assert.equal(poseTexture.disposed,true);assert.equal(mesh.geometry.disposed,true);assert.equal(mesh.material.disposed,true);
});
test('both apps consume declared shared exports and keep the opt-in separate from gameplay',()=>{
 const root=new URL('../',import.meta.url),read=path=>readFileSync(new URL(path,root),'utf8');
 for(const path of ['apps/review/src/shino25d-workshop.js','apps/review/src/hybrid-25d-lab.js','apps/rinne/src/rebuild/shino25d-guest.js']){const source=read(path);assert.match(source,/@soul\/assets\/(sprite25d|character25d)/);assert.ok(!source.includes('../packages/'));}
 const pkg=JSON.parse(read('packages/assets/package.json'));for(const suffix of ['','/browser','/three'])assert.ok(pkg.exports['./sprite25d'+suffix]);
 const guest=read('apps/rinne/src/rebuild/shino25d-guest.js');assert.ok(guest.includes('!state.interior'));assert.ok(guest.includes('!renderOptions?.titlePreview'));assert.ok(!guest.includes('localStorage'));
});

