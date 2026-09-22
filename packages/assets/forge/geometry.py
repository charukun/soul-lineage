import math
from common import clamp

def _mix(a,b,t):return a*(1-t)+b*t
def _ring(a,b,t):
    keys=('y','cx','rx','frontDepth','backDepth','centerOffset','frontPower','backPower')
    return {k:_mix(a[k],b[k],t) for k in keys}

def surface(component,u,v):
    rings=component['rings'];f=clamp(v,0,1)*(len(rings)-1);i=min(len(rings)-2,int(f));t=f-i;r=_ring(rings[i],rings[i+1],t)
    theta=math.pi/2+math.pi*u if component['kind']=='rear-shell' else 2*math.pi*u
    s=math.sin(theta);c=math.cos(theta);x=r['cx']+r['rx']*s
    depth=r['frontDepth'] if c>=0 else r['backDepth'];power=r['frontPower'] if c>=0 else r['backPower']
    shaped=math.copysign(abs(c)**(2.0/power),c);z=depth*shaped
    # Numerical tangent gives normals for the asymmetric superellipse section.
    eps=1e-4
    def point(th):
        ss=math.sin(th);cc=math.cos(th);dd=r['frontDepth'] if cc>=0 else r['backDepth'];pp=r['frontPower'] if cc>=0 else r['backPower']
        return [r['cx']+r['rx']*ss,r['y'],dd*math.copysign(abs(cc)**(2.0/pp),cc)]
    p0=point(theta-eps);p1=point(theta+eps);tx=p1[0]-p0[0];tz=p1[2]-p0[2]
    nx,nz=tz,-tx;length=math.hypot(nx,nz) or 1;normal=[nx/length,0,nz/length]
    return [x,r['y'],z],normal

def generate_geometry(spec):
    meshes=[]
    for comp in spec['components']:
        positions=[];normals=[];uv=[];indices=[];segments=24;rows=16
        for row in range(rows+1):
            for col in range(segments+1):
                p,n=surface(comp,col/segments,row/rows)
                if comp['id']=='head' and n[2]>.15:
                    # Use all side-derived facial planes. The weighted displacement is
                    # broad enough to shape cranium/face, not merely a nose spike.
                    bands=list(spec['face'].values());weights=[math.exp(-((p[1]-b['y'])/.055)**2) for b in bands];total=sum(weights) or 1
                    target=sum(b['forward']*w for b,w in zip(bands,weights))/total
                    current=max(r['frontDepth'] for r in comp['rings'])
                    p[2]+=(target-current)*max(0,n[2])*.75
                positions.append(p);normals.append(n);uv.append([col/segments,row/rows])
        for row in range(rows):
            for col in range(segments):
                a=row*(segments+1)+col;b=a+1;c=a+segments+1;d=c+1;indices.extend([a,b,c,b,d,c])
        for row,reverse in [(0,True),(rows,False)]:
            ring=comp['rings'][0 if row==0 else -1];center=len(positions)
            positions.append([ring['cx'],ring['y'],0]);normals.append([0,-1 if reverse else 1,0]);uv.append([.5,row/rows])
            for col in range(segments):
                a=row*(segments+1)+col;indices.extend([center,a+1,a] if reverse else [center,a,a+1])
        if comp['kind']=='rear-shell':
            for row in range(rows):
                a=row*(segments+1);b=a+segments;c=a+segments+1;d=c+segments;indices.extend([a,c,b,b,c,d])
        meshes.append({'id':comp['id'],'component':comp,'positions':positions,'normals':normals,'uv':uv,'indices':indices})
    return meshes
