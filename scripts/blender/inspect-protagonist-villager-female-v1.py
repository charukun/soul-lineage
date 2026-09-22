"""Read-only inspection and neutral fixed-view renders for the female protagonist DCC asset."""
from __future__ import annotations
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector

def parse_args():
    p=argparse.ArgumentParser(); p.add_argument("--out", required=True)
    argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    return p.parse_args(argv)

def bounds(objects):
    pts=[o.matrix_world @ Vector(corner) for o in objects for corner in o.bound_box]
    if not pts: raise RuntimeError("no mesh bounds")
    lo=Vector((min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts)))
    hi=Vector((max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts)))
    return lo,hi

def look_at(obj,target):
    obj.rotation_euler=(target-obj.location).to_track_quat("-Z","Y").to_euler()

def main():
    args=parse_args(); out=Path(args.out).resolve(); out.mkdir(parents=True,exist_ok=True)
    scene=bpy.context.scene
    meshes=[o for o in scene.objects if o.type=="MESH" and o.name.lower() not in {"plane","ground"}]
    arms=[o for o in scene.objects if o.type=="ARMATURE"]
    lo,hi=bounds(meshes); center=(lo+hi)*.5; height=max(.4,hi.z-lo.z); width=max(.2,hi.x-lo.x)
    rows=[]
    for o in meshes:
        blo,bhi=bounds([o])
        rows.append({
            "name":o.name,
            "vertices":len(o.data.vertices),
            "polygons":len(o.data.polygons),
            "materials":[m.name for m in o.data.materials if m],
            "vertexGroups":[g.name for g in o.vertex_groups],
            "bboxMin":[round(v,5) for v in blo],
            "bboxMax":[round(v,5) for v in bhi],
            "parent":o.parent.name if o.parent else None,
            "modifiers":[{"name":m.name,"type":m.type} for m in o.modifiers],
        })
    meta={
        "blender":bpy.app.version_string,
        "armatures":[{"name":a.name,"bones":[b.name for b in a.data.bones]} for a in arms],
        "meshes":rows,
        "bounds":{"min":[round(v,5) for v in lo],"max":[round(v,5) for v in hi],"height":height,"width":width}
    }
    (out/"inspection.json").write_text(json.dumps(meta,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    for o in list(scene.objects):
        if o.type in {"CAMERA","LIGHT"}: bpy.data.objects.remove(o,do_unlink=True)
    scene.render.resolution_x=720; scene.render.resolution_y=900; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.world.color=(0.045,0.048,0.052)
    try: scene.render.engine="BLENDER_EEVEE_NEXT"
    except TypeError: scene.render.engine="BLENDER_EEVEE"
    target=Vector((center.x,center.y,lo.z+height*.52)); dist=max(2.4,height*2.5)
    bpy.ops.object.camera_add(location=(center.x,center.y-dist,target.z))
    cam=bpy.context.object; cam.data.type="ORTHO"; cam.data.ortho_scale=height*1.16; scene.camera=cam
    for loc,energy,size,color in [
        ((center.x-2.4,center.y-2.8,hi.z+1.0),720,3.3,(1.0,.92,.82)),
        ((center.x+2.6,center.y-1.4,target.z+.4),360,3.0,(.82,.88,1.0)),
        ((center.x,center.y+2.7,hi.z+.6),500,2.6,(.82,.90,1.0)),
    ]:
        bpy.ops.object.light_add(type="AREA",location=loc); l=bpy.context.object
        l.data.energy=energy;l.data.size=size;l.data.color=color;look_at(l,target)
    views={
      "front":Vector((center.x,center.y-dist,target.z)),
      "three-quarter":Vector((center.x+dist*.72,center.y-dist*.72,target.z+height*.02)),
      "side":Vector((center.x+dist,center.y,target.z)),
      "back":Vector((center.x,center.y+dist,target.z)),
    }
    for name,loc in views.items():
        cam.data.ortho_scale=height*1.16; cam.location=loc; look_at(cam,target)
        scene.render.filepath=str(out/f"{name}.png"); bpy.ops.render.render(write_still=True)
    face=Vector((center.x,center.y,lo.z+height*.84))
    cam.data.ortho_scale=max(width*.95,height*.36); cam.location=Vector((center.x,center.y-dist,face.z)); look_at(cam,face)
    scene.render.filepath=str(out/"face.png"); bpy.ops.render.render(write_still=True)
    print(json.dumps({"meshCount":len(meshes),"armatureCount":len(arms),"out":str(out)},ensure_ascii=False))
if __name__=="__main__": main()
