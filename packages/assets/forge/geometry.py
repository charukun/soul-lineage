import math
from common import clamp
from side_profiles import curve

def point(component,u,v):
    rings=component['rings'];f=clamp(v,0,1)*(len(rings)-1);i=min(len(rings)-2,int(f));t=f-i
    y,cx,cz,rx,rz=[rings[i][j]*(1-t)+rings[i+1][j]*t for j in range(5)]
    theta=math.pi/2+math.pi*u if component['kind']=='rear-shell' else 2*math.pi*u
    x=cx+rx*math.sin(theta);cosine=math.cos(theta)
    profiles=component.get('sectionProfiles')
    if profiles:
        section={key:profiles[i][key]*(1-t)+profiles[i+1][key]*t for key in
                 ('centerOffset','frontDepth','backDepth','frontFullness','backFullness')}
        front=cosine>=0
        depth=section['frontDepth' if front else 'backDepth']
        fullness=section['frontFullness' if front else 'backFullness']
        z=section['centerOffset']+(1 if front else -1)*depth*curve(abs(cosine),fullness)
    else:
        z=cz+rz*cosine  # compatibility for already-authored v1 packages
    return [x,y,z]

def surface(component,u,v):
    p=point(component,u,v);epsilon=1e-5
    # The same surface drives mesh and texture projection. Recompute derivatives
    # after asymmetric reconstruction, including changing center offsets.
    ua,ub=(max(0,u-epsilon),min(1,u+epsilon)) if component['kind']=='rear-shell' else (u-epsilon,u+epsilon)
    va,vb=max(0,v-epsilon),min(1,v+epsilon)
    du=[b-a for a,b in zip(point(component,ua,v),point(component,ub,v))]
    dv=[b-a for a,b in zip(point(component,u,va),point(component,u,vb))]
    n=[du[1]*dv[2]-du[2]*dv[1],du[2]*dv[0]-du[0]*dv[2],du[0]*dv[1]-du[1]*dv[0]]
    length=math.sqrt(sum(a*a for a in n))
    if length<1e-16:raise ValueError('Degenerate section in '+component['id'])
    return p,[a/length for a in n]

def generate_geometry(spec):
    meshes=[]
    for comp in spec['components']:
        positions=[];normals=[];uv=[];indices=[];segments=24
        rows=2*(len(comp['rings'])-1)
        for row in range(rows+1):
            for col in range(segments+1):
                p,n=surface(comp,col/segments,row/rows)
                positions.append(p);normals.append(n);uv.append([col/segments,row/rows])
        for row in range(rows):
            for col in range(segments):
                a=row*(segments+1)+col;b=a+1;c=a+segments+1;d=c+1
                indices.extend([a,b,c,b,d,c])
        for row,reverse in [(0,True),(rows,False)]:
            ring=comp['rings'][0 if row==0 else -1];center=len(positions)
            section=comp.get('sectionProfiles')
            cz=section[0 if row==0 else -1]['centerOffset'] if section else ring[2]
            positions.append([ring[1],ring[0],cz]);normals.append([0,-1 if reverse else 1,0]);uv.append([.5,row/rows])
            for col in range(segments):
                a=row*(segments+1)+col
                indices.extend([center,a+1,a] if reverse else [center,a,a+1])
        if comp['kind']=='rear-shell':
            for row in range(rows):
                a=row*(segments+1);b=a+segments;c=a+segments+1;d=c+segments
                indices.extend([a,c,b,b,c,d])
        meshes.append({'id':comp['id'],'component':comp,'positions':positions,'normals':normals,'uv':uv,'indices':indices})
    return meshes
