from common import clamp

def skin_meshes(meshes,bones):
    by_name={b['name']:i for i,b in enumerate(bones)}
    for mesh in meshes:
        owner=mesh['component']['bone']; first=by_name[owner]; parent=bones[first]['parent']; second=by_name.get(parent,first)
        pivot=bones[first]['position'][1];joints=[];weights=[]
        for p in mesh['positions']:
            # Soft band at parent/child joins; rigid head and feet intentionally retain their own bone.
            blend=0 if owner in ('head','neck') or owner.startswith(('hand','foot')) else .45*clamp((p[1]-pivot+.025)/.05,0,1)
            joints.append([first,second,0,0]);weights.append([1-blend,blend,0,0])
        mesh['joints']=joints;mesh['weights']=weights
