import math
from common import clamp

def surface(component,u,v):
    rings=component['rings']; f=clamp(v,0,1)*(len(rings)-1); i=min(len(rings)-2,int(f)); t=f-i
    y,cx,cz,rx,rz=[rings[i][j]*(1-t)+rings[i+1][j]*t for j in range(5)]
    theta=math.pi/2+math.pi*u if component['kind']=='rear-shell' else 2*math.pi*u
    x=cx+rx*math.sin(theta); z=cz+rz*math.cos(theta)
    normal=[math.sin(theta)/rx,0,math.cos(theta)/rz]
    slope=(rings[i+1][3]-rings[i][3])/(rings[i+1][0]-rings[i][0])
    normal[1]=-slope/rx
    length=math.sqrt(sum(a*a for a in normal)); normal=[a/length for a in normal]
    return [x,y,z],normal

def generate_geometry(spec):
    meshes=[]
    for comp in spec['components']:
        positions=[];normals=[];uv=[];indices=[];segments=24;rows=16
        for row in range(rows+1):
            for col in range(segments+1):
                p,n=surface(comp,col/segments,row/rows)
                # Add a measured side-profile ridge to the face instead of a sphere.
                if comp['id']=='head' and n[2]>.5:
                    nose=spec['face']['nose']; eye=spec['face']['eyePlane']
                    ridge=max(0,nose['forward']-eye['forward'])
                    p[2]+=ridge*math.exp(-((p[1]-nose['y'])/.025)**2)*math.exp(-(p[0]/.025)**2)
                positions.append(p);normals.append(n);uv.append([col/segments,row/rows])
        for row in range(rows):
            for col in range(segments):
                a=row*(segments+1)+col;b=a+1;c=a+segments+1;d=c+1
                indices.extend([a,b,c,b,d,c])
        # Close the ends and, for rear shells, the medial cut. Solid volumes.
        for row,reverse in [(0,True),(rows,False)]:
            ring=comp['rings'][0 if row==0 else -1];center=len(positions)
            positions.append([ring[1],ring[0],ring[2]]);normals.append([0,-1 if reverse else 1,0]);uv.append([.5,row/rows])
            for col in range(segments):
                a=row*(segments+1)+col
                indices.extend([center,a+1,a] if reverse else [center,a,a+1])
        if comp['kind']=='rear-shell':
            for row in range(rows):
                a=row*(segments+1);b=a+segments;c=a+segments+1;d=c+segments
                indices.extend([a,c,b,b,c,d])
        meshes.append({'id':comp['id'],'component':comp,'positions':positions,'normals':normals,'uv':uv,'indices':indices})
    return meshes
