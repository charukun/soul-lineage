"""Validate the pre-rig DCC handoff without relabelling its production audit."""
import argparse,json,hashlib
from pathlib import Path

def validate(w):
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    report=json.loads((w/'build/dcc/refinement.json').read_text())
    audit=json.loads((w/'build/dcc/blender-audit.json').read_text())
    if report['sourceFactorySha256']!=sha(w/'build/material-pass.ts'):raise ValueError('DCC source factory changed')
    if report['sourceMeshPayloadSha256']!=sha(w/'review/material-pass/mesh-buffers.json'):raise ValueError('DCC source buffers changed')
    if report['outputSha256']!=sha(w/'build/dcc/refined-hair.json'):raise ValueError('DCC output changed')
    required=('hasMesh','hasUVs','transformsApplied','noDegeneratePolygons')
    if any(audit['checks'].get(k) is not True for k in required):raise ValueError('Pre-rig geometry audit failed')
    if audit['scene']['armatures']!=0 or audit['scene']['bones']!=0 or audit['checks']['singleArmature'] is not False:raise ValueError('Unexpected pre-rig audit scope')
    if report['rigFrozen'] or report['sourcePixelsChanged'] or report['otherGeometryChanged']:raise ValueError('Correction exceeded its allowed scope')
    receipt={'status':'pre-rig geometry transport checked; browser/reference approval pending','productionAuditPassed':False,'expectedUnmetProductionCheck':'singleArmature; the raw reconstruction must pass likeness review before Golden Rig attachment','requiredRawChecks':list(required),'auditSha256':sha(w/'build/dcc/blender-audit.json'),'refinedMeshSha256':report['outputSha256'],'upstreamAndProductionGatesChanged':False}
    (w/'build/dcc/pre-rig-check.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--workspace',type=Path,required=True);a=p.parse_args();validate(a.workspace.resolve())
