import json
import math
import struct
from PIL import Image,ImageDraw,ImageChops
from normalization import SIZE,PAD,HEIGHT
from common import digest
from side_profiles import depth_diagnostics

def read_export(path):
    data=path.read_bytes();magic,version,length=struct.unpack_from('<III',data)
    if magic!=0x46546c67 or version!=2 or length!=len(data):raise ValueError('Invalid GLB envelope')
    n=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+n]);binary=data[28+n:]
    def get(index):
        a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];offset=v.get('byteOffset',0)+a.get('byteOffset',0)
        if a.get('sparse'):raise ValueError('Sparse accessor requires explicit DCC normalization')
        size={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];code={5126:'f',5123:'H',5125:'I',5121:'B'}[a['componentType']]
        stride=v.get('byteStride',struct.calcsize(code)*size)
        return [struct.unpack_from('<'+code*size,binary,offset+i*stride) for i in range(a['count'])]
    return data,doc,get

def validate_export(spec,views,model,texture_info,out):
    data,doc,get=read_export(model);meshes=[];errors=[];warnings=[];positions=[]
    for mesh in doc['meshes']:
        p=mesh['primitives'][0];pos=get(p['attributes']['POSITION']);idx=[v[0] for v in get(p['indices'])];weights=get(p['attributes']['WEIGHTS_0']);joints=get(p['attributes']['JOINTS_0'])
        if any(abs(sum(w)-1)>.00001 or any(a<0 for a in w) for w in weights):errors.append('Invalid skin weights')
        if any(max(j)>=len(doc['skins'][0]['joints']) for j in joints):errors.append('Invalid joints')
        if any(not math.isfinite(x) for p in pos for x in p):errors.append('Nonfinite geometry')
        if max(p[2] for p in pos)-min(p[2] for p in pos)<.004:errors.append('Flat component '+mesh['name'])
        meshes.append((pos,idx));positions+=pos
    comparisons={};out.mkdir(parents=True,exist_ok=True)
    for view in ('front','side','back'):
        if view not in views:continue
        render=Image.new('L',(SIZE,SIZE));draw=ImageDraw.Draw(render)
        for pos,idx in meshes:
            points=[(SIZE/2+(p[0] if view=='front' else -p[0] if view=='back' else -p[2])/1.6*HEIGHT,SIZE-PAD-p[1]/1.6*HEIGHT) for p in pos]
            for i in range(0,len(idx),3):draw.polygon([points[idx[i+k]] for k in range(3)],fill=255)
        reference=views[view]['mask'];inter=ImageChops.multiply(reference,render);union=ImageChops.lighter(reference,render)
        area=lambda img:sum(img.histogram()[1:])
        rb=reference.getbbox();gb=render.getbbox()
        if not rb or not gb:raise ValueError('Missing reference/export silhouette: '+view)
        iou=area(inter)/max(1,area(union))
        band=round(SIZE-PAD-spec['levels']['chin']*HEIGHT)
        head_ratio=lambda image:area(image.crop((0,0,SIZE,band)))/max(1,area(image))
        metric={'silhouetteMismatch':1-iou,'iou':iou,'heightMismatch':abs((rb[3]-rb[1])-(gb[3]-gb[1]))/HEIGHT,
          'headBodyProportionMismatch':abs(head_ratio(reference)-head_ratio(render)),'groundAlignmentMismatch':abs(rb[3]-gb[3])/HEIGHT,
          'camera':'orthographic +Y-up; fixed 1.6m height, ground=0, no per-render auto-fit','status':'needs-review' if 1-iou>.30 else 'diagnostic-pass'}
        if view=='side':
            metric['depthMismatch']=depth_diagnostics(reference,render,spec)
            if metric['depthMismatch']['status']=='needs-review':warnings.append('side front/back/center depth mismatch requires local review')
        if metric['status']=='needs-review':warnings.append(view+' silhouette mismatch exceeds 0.30')
        render.save(out/(view+'-silhouette.png'))
        overlay=Image.merge('RGB',(reference,render,Image.new('L',(SIZE,SIZE))));overlay.save(out/(view+'-silhouette-overlay.png'))
        comparisons[view]=metric
    stats={'triangles':sum(len(idx)//3 for _,idx in meshes),'vertices':len(positions),'materials':len(doc['materials']),'textures':len(doc['textures']),
      'textureDimensions':[texture_info['dimensions']],'approximateDrawCalls':len(meshes),'glbSize':len(data)}
    if stats['triangles']>30000 or len(data)>8_000_000:warnings.append('Web candidate budget exceeded; cannot approve')
    if len(doc['animations'])<6:errors.append('Required animation clips missing')
    for clip in doc['animations']:
        if not clip['channels'] or all(len(set(get(s['output'])))<2 for s in clip['samplers']):errors.append('Static placeholder clip '+clip['name'])
    for view in views:
        if texture_info['sampleContributions'][view]<=0:errors.append('Ignored projection view '+view)
    return {'schemaVersion':'rinne.character-forge-validation/v1','structuralStatus':'failed' if errors else 'passed','visualStatus':'needs-human-review','reviewStatus':'review-candidate',
      'productionReady':False,'modelSha256':digest(data),'performance':stats,'comparisons':comparisons,'errors':errors,'warnings':warnings,
      'limitations':['Silhouette rasterization is deterministic CPU projection of delivered GLB triangles, not physical-device or perceptual acceptance','Concavity, asymmetric hidden surfaces, finger topology and foot contact remain unapproved','Side endpoint errors use fixed coordinates, not per-view recentering; anatomical centers and hidden curvature remain inferred']}
