import json
from common import save_json

FIXED_VIEWS=['front','side','back','three-quarter']
MAX_ROUNDS=3

def create_quality_refinement(model_sha,report,out):
    failed=[{'kind':'silhouette','view':v,'metrics':m} for v,m in report.get('comparisons',{}).items() if m.get('status')=='needs-review']
    failed += [{'kind':'side-depth','region':r,'metrics':m} for r,m in report.get('sideDepthDiagnostics',{}).items() if m.get('status')=='needs-review']
    doc={'schemaVersion':'rinne.character-forge-refinement/v1','modelSha256':model_sha,'status':'pending-dcc-review',
      'maxRounds':MAX_ROUNDS,'requiredFixedViews':FIXED_VIEWS,'qualityReferences':['source-turnaround','repository-approved-quality-reference'],
      'rounds':[],'diagnostics':failed,
      'contract':['capture fixed front/side/back/three-quarter from the delivered model','compare against source reference and repository Quality Reference','record failed regions without hiding them with camera/light changes','edit the real model in Blender/DCC','re-export the same candidate package','re-capture and compare the new model hash','repeat failed regions only, for at most three rounds'],
      'completionRule':'structural validation alone never completes Forge; visual approval remains pending until the fixed-view DCC loop is reviewed'}
    save_json(out,doc);return doc
