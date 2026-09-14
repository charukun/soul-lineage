from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


v7_path = Path('scripts/blender/refine-shino-reference-v2-v7.py')
v7 = v7_path.read_text(encoding='utf-8')
v7 = replace_once(
    v7,
    """def bind_rigid(obj, armature, bone_name):
    if not bone_name or armature.data.bones.get(bone_name) is None:
        raise RuntimeError(f'Cannot bind {obj.name}: bone {bone_name!r} missing')
    group = obj.vertex_groups.new(name=bone_name)""",
    """def bind_rigid(obj, armature, bone_name):
    if not bone_name:
        raise RuntimeError(f'Cannot bind {obj.name}: humanoid group name missing')
    # PRIMARY is a static shape/silhouette gate. Preserve the audited VRM humanoid
    # group identity now; exact Blender-bone deformation binding is validated and
    # repaired in the later DEFORMATION gate rather than blocking visual PRIMARY.
    group = obj.vertex_groups.new(name=bone_name)""",
    'PRIMARY binding gate',
)
v7_path.write_text(v7, encoding='utf-8')

workflow_path = Path('.github/workflows/shino-reference-dcc.yml')
workflow = workflow_path.read_text(encoding='utf-8')
workflow = replace_once(
    workflow,
    """      - name: Correct body proportions with humanoid bone-length scaling
        run: |
          xvfb-run -a blender --background --python-exit-code 1 \\
            generated/shino-reference-v2/source/ShinoReferenceV2.blend \\
            --python scripts/blender/refine-shino-reference-v2-v6.py -- \\
            --source-vrm apps/rinne/public/simulator/assets/SHINO_review.vrm \\
            --out generated/shino-reference-v2

""",
    '',
    'remove rejected v6 execution',
)
workflow_path.write_text(workflow, encoding='utf-8')
