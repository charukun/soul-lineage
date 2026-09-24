import {GALLERY_SEEDS} from './gallery-seeds.mjs';
const PREFIX='/api/gallery';
const MAX_BYTES=5*1024*1024;
const MAX_ITEMS=120;
const CHUNK_SIZE=128*1024;
const TYPES={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
const GAMES=new Set(['rinne','village','demon','shared']);
const KINDS=new Set(['character','scene','interface','world','other']);
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const validId=id=>/^[0-9a-f-]{36}$/.test(id||'');
const clean=(value,max)=>String(value||'').trim().slice(0,max);
const sameOrigin=request=>request.headers.get('origin')===new URL(request.url).origin;
const imageType=(bytes,type)=>{
  if(type==='image/png'&&bytes.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return type;
  if(type==='image/jpeg'&&bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return type;
  if(type==='image/webp'&&bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return type;
  return null;
};
const publicRow=row=>({id:row.id,title:row.title,note:row.note,game:row.game,kind:row.kind,createdAt:row.createdAt,media:`${PREFIX}/${row.id}/image`,bytes:row.bytes});

// A single SQLite-backed Durable Object keeps the catalog and images across deployments.
export class ReviewGallery {
  constructor(state){this.state=state}
  async fetch(request){
    const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean),id=parts[1];
    const storage=this.state.storage;
    if(request.method==='GET'&&parts.length===1){
      const rows=await storage.get('gallery:index')||[];
      const hidden=await storage.get('gallery:hidden')||[];
      return json({items:[...GALLERY_SEEDS.filter(item=>!hidden.includes(item.id)),...rows.map(publicRow)]});
    }
    if(request.method==='POST'&&parts.length===1){
      const form=await request.formData(),file=form.get('image');
      const title=clean(form.get('title'),80),note=clean(form.get('note'),500);
      const game=clean(form.get('game'),24),kind=clean(form.get('kind'),24);
      if(!(file instanceof Blob)||!title||!GAMES.has(game)||!KINDS.has(kind))return json({error:'invalid_entry'},400);
      if(file.size<1||file.size>MAX_BYTES||!TYPES[file.type])return json({error:'invalid_image_size_or_type'},400);
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(!imageType(bytes,file.type))return json({error:'invalid_image_content'},400);
      const rows=await storage.get('gallery:index')||[];
      if(rows.length>=MAX_ITEMS)return json({error:'gallery_full'},409);
      const id=crypto.randomUUID(),count=Math.ceil(bytes.length/CHUNK_SIZE);
      try{
        for(let i=0;i<count;i++)await storage.put(`gallery:${id}:${i}`,bytes.slice(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE).buffer);
        const row={id,title,note,game,kind,type:file.type,bytes:bytes.length,count,createdAt:new Date().toISOString()};
        await storage.put('gallery:index',[row,...rows]);
        return json({item:publicRow(row)},201);
      }catch(error){
        for(let i=0;i<count;i++)await storage.delete(`gallery:${id}:${i}`);
        throw error;
      }
    }
    const seeded=GALLERY_SEEDS.find(item=>item.id===id);
    if(seeded&&request.method==='DELETE'&&parts.length===2){
      const hidden=await storage.get('gallery:hidden')||[];
      if(!hidden.includes(id))await storage.put('gallery:hidden',[...hidden,id]);
      return json({deleted:id,sourcePreserved:true});
    }
    if(!validId(id))return json({error:'not_found'},404);
    const rows=await storage.get('gallery:index')||[],row=rows.find(item=>item.id===id);
    if(!row)return json({error:'not_found'},404);
    if(request.method==='GET'&&parts.length===3&&parts[2]==='image'){
      const bytes=new Uint8Array(row.bytes);let at=0;
      for(let i=0;i<row.count;i++){
        const part=await storage.get(`gallery:${id}:${i}`);
        if(!(part instanceof ArrayBuffer))return json({error:'image_missing'},503);
        bytes.set(new Uint8Array(part),at);at+=part.byteLength;
      }
      return new Response(bytes,{headers:{'content-type':row.type,'content-length':String(row.bytes),'cache-control':'private, max-age=300','x-content-type-options':'nosniff'}});
    }
    if(request.method==='DELETE'&&parts.length===2){
      await storage.put('gallery:index',rows.filter(item=>item.id!==id));
      for(let i=0;i<row.count;i++)await storage.delete(`gallery:${id}:${i}`);
      return json({deleted:id});
    }
    return json({error:'not_found'},404);
  }
}

export async function handleGallery(request,env){
  const url=new URL(request.url);
  if(!url.pathname.startsWith(PREFIX))return null;
  if(!env.REVIEW_GALLERY)return json({error:'gallery_unavailable'},503);
  if(!['GET','POST','DELETE'].includes(request.method))return json({error:'method_not_allowed'},405);
  if(request.method!=='GET'){
    if(!sameOrigin(request))return json({error:'origin_not_allowed'},403);
    if(Number(request.headers.get('content-length')||0)>MAX_BYTES+32*1024)return json({error:'payload_too_large'},413);
    const ip=request.headers.get('cf-connecting-ip')||'unknown';
    const limit=await env.HI3DGEN_LIMITS.get(env.HI3DGEN_LIMITS.idFromName('gallery:'+ip)).fetch(new Request('https://internal/take',{method:'POST',headers:{'x-gallery-limit':'40'}}));
    if(!limit.ok)return limit;
  }
  const path=url.pathname.slice(PREFIX.length)||'';
  return env.REVIEW_GALLERY.get(env.REVIEW_GALLERY.idFromName('design-gallery-v1')).fetch(new Request('https://internal/gallery'+path,{method:request.method,headers:request.headers,body:request.method==='POST'?request.body:undefined,duplex:request.method==='POST'?'half':undefined}));
}
