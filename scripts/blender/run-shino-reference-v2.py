"""Compatibility launcher for the Shino Reference v2 Blender builder.

Ubuntu's Blender 4.0 package exposes the render engine enum differently from later
Blender builds. Keep the modeling source readable while applying the tiny 4.0/4.1+
compatibility shim before executing it. Blender is invoked with --python-exit-code
so any modeling exception fails the workflow immediately.
"""
from pathlib import Path

TARGET = Path(__file__).with_name("build-shino-reference-v2.py")
source = TARGET.read_text(encoding="utf-8")
old = '''    if "BLENDER_EEVEE_NEXT" in {item.identifier for item in scene.bl_rna.properties["render_engine"].enum_items}:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    else:
        scene.render.engine = "BLENDER_EEVEE"
'''
new = '''    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except (TypeError, ValueError):
        scene.render.engine = "BLENDER_EEVEE"
'''
if old not in source:
    raise RuntimeError("Blender render compatibility target changed; update launcher explicitly")
source = source.replace(old, new, 1)
namespace = {"__name__": "__main__", "__file__": str(TARGET)}
exec(compile(source, str(TARGET), "exec"), namespace)
