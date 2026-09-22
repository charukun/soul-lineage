"""Synthetic contract tests; mock receipts here are never visual evidence."""
import copy
import json
import math
from pathlib import Path
import sys
import tempfile
import unittest
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parents[2]/'packages/assets/forge'))
from side_profiles import apply_side_profiles, curve, side_bounds, depth_diagnostics
from geometry import surface, generate_geometry
from common import digest, save_json
from refinement import initialize, assess, verify_capture, VIEWS, CHECKS, STATE_PATH, inside
from registration import register_review
from blender_refinement import check_recipe, correction

def specification():
    heights=[('forehead',.94),('eyePlane',.90),('cheek',.87),('nose',.85),('mouthPlane',.82),('jaw',.80),('chin',.78)]
    components=[]
    for name,lo,hi in [('head',.77,1),('torso',.48,.72),('pelvis',.41,.51),('upperArm.L',.53,.72),('hand.L',.34,.41),('upperLeg.L',.25,.46),('lowerLeg.L',.065,.27),('foot.L',.005,.07)]:
        components.append({'id':name,'kind':'loft','evidence':{},'rings':[[lo+(hi-lo)*i/8,0,0,.10 if name=='head' else .07,.09] for i in range(9)]})
    rows=[{'y':i/100,'runs':[[-(.12+.025*math.sin(i*.2)),.08+.02*math.cos(i*.13)]]} for i in range(1,100)]
    return {'components':components,'silhouette':{'side':rows},'levels':{'chin':.77,'shoulder':.72,'chest':.65,'waist':.55,'hip':.46,'ankle':.055},'face':{k:{'y':y} for k,y in heights}}

class Sections(unittest.TestCase):
    def test_equal_depth_does_not_erase_position(self):
        a=[{'y':.5,'runs':[[-.18,.07]]}]; b=[{'y':.5,'runs':[[-.21,.04]]}]
        self.assertAlmostEqual(side_bounds(a,.5)[0]-side_bounds(a,.5)[1],side_bounds(b,.5)[0]-side_bounds(b,.5)[1])
        self.assertNotEqual(side_bounds(a,.5),side_bounds(b,.5))
    def test_independent_front_back_and_center(self):
        spec=apply_side_profiles(specification())
        asymmetric=[]
        for comp in spec['components']:
            for r in comp['sectionProfiles']:
                self.assertAlmostEqual(r['centerOffset']+r['frontDepth'],r['frontZ'])
                self.assertAlmostEqual(r['centerOffset']-r['backDepth'],r['backZ'])
                self.assertGreater(r['frontDepth'],0);self.assertGreater(r['backDepth'],0)
                asymmetric.append(abs(r['frontDepth']-r['backDepth']))
        self.assertGreater(max(asymmetric),.01)
    def test_regional_curvature_is_not_ellipse(self):
        spec=apply_side_profiles(specification())
        self.assertNotEqual(spec['sideReconstruction']['regions']['thorax'],spec['sideReconstruction']['regions']['glute'])
        self.assertNotEqual(curve(.6,1.3),.6)
        for f in (.55,1,1.45):
            values=[curve(i/100,f) for i in range(101)]
            self.assertEqual(values[0],0);self.assertEqual(values[-1],1);self.assertEqual(values,sorted(values))
    def test_every_face_plane_is_geometry_and_occiput_independent(self):
        spec=apply_side_profiles(specification());head=spec['components'][0]
        for feature in spec['face'].values():
            i=next(i for i,r in enumerate(head['rings']) if r[0]==feature['y'])
            front,n=surface(head,0,i/(len(head['rings'])-1));back,_=surface(head,.5,i/(len(head['rings'])-1))
            self.assertAlmostEqual(front[2],feature['forward']);self.assertAlmostEqual(back[2],feature['rear'])
            self.assertAlmostEqual(sum(v*v for v in n),1)
        self.assertNotEqual(head['sectionProfiles'][3]['frontFullness'],head['sectionProfiles'][3]['backFullness'])
    def test_forehead_is_not_a_nose_only_ridge(self):
        raw=specification();changed=copy.deepcopy(raw)
        next(r for r in changed['silhouette']['side'] if r['y']==.94)['runs'][0][0]-=.04
        a=apply_side_profiles(raw)['components'][0];b=apply_side_profiles(changed)['components'][0]
        i=next(i for i,r in enumerate(a['rings']) if r[0]==.94);v=i/(len(a['rings'])-1)
        self.assertAlmostEqual(surface(b,0,v)[0][2]-surface(a,0,v)[0][2],.04)
        self.assertAlmostEqual(surface(b,.5,v)[0][2],surface(a,.5,v)[0][2])
    def test_normals_and_topology_are_finite(self):
        for mesh in generate_geometry(apply_side_profiles(specification())):
            self.assertEqual(len(mesh['positions']),len(mesh['normals']))
            for n in mesh['normals']:self.assertTrue(all(math.isfinite(v) for v in n));self.assertAlmostEqual(sum(v*v for v in n),1,places=5)
            self.assertLess(max(mesh['indices']),len(mesh['positions']))
    def test_occlusion_remains_inferred(self):
        spec=apply_side_profiles(specification())
        hand=next(c for c in spec['components'] if c['id']=='hand.L')
        self.assertTrue(all(r['status']=='inferred' and r['occludedPart'] for r in hand['sectionProfiles']))
        self.assertEqual(spec['sideReconstruction']['axisStatus'],'inferred')
    def test_single_view_is_explicit_fallback(self):
        raw=specification();raw['silhouette']={};spec=apply_side_profiles(raw)
        self.assertEqual(spec['sideReconstruction']['measurements'],{})
        self.assertTrue(all(r['status']=='inferred' for c in spec['components'] for r in c['sectionProfiles']))
    def test_bad_profiles_fail_closed(self):
        for options in ({'regions':{'wrong':{}}},{'regions':{'thorax':{'frontFullness':float('nan')}}},{'facing':'right'}):
            with self.assertRaises(ValueError):apply_side_profiles(specification(),{'sideReconstruction':options})
    def test_fixed_side_diagnoses_shift_even_when_depth_equal(self):
        a=Image.new('L',(320,320));b=Image.new('L',(320,320));ImageDraw.Draw(a).rectangle((100,16,200,303),fill=255);ImageDraw.Draw(b).rectangle((110,16,210,303),fill=255)
        report=depth_diagnostics(a,b,specification())
        self.assertAlmostEqual(report['maxTotalDepthError'],0);self.assertGreater(report['maxFrontError'],.03);self.assertGreater(report['maxCenterError'],.03)
        self.assertEqual(report['status'],'needs-review')
    def test_dcc_correction_is_local_and_preserves_x_y(self):
        comp=apply_side_profiles(specification())['components'][1]
        edit={'component':'torso','findingId':'chest','band':[.58,.70],'frontDelta':.02}
        recipe={'schemaVersion':'rinne.forge-dcc-corrections/v1','edits':[edit]};check_recipe(recipe,{'torso'})
        self.assertEqual(correction([.02,.5,.1],comp,[edit]),[.02,.5,.1])
        p=correction([.02,.65,.1],comp,[edit]);self.assertEqual(p[:2],[.02,.65]);self.assertGreater(p[2],.1)
        with self.assertRaises(ValueError):check_recipe({**recipe,'edits':[{**edit,'frontDelta':1}]},{'torso'})

class RefinementContract(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.d=self.root/'packages/assets/characters/forge/test';self.d.mkdir(parents=True)
        # These mock bytes exercise integrity/state transitions only, never DCC acceptance.
        (self.d/'model.glb').write_bytes(b'synthetic-test-model');self.hash=digest(b'synthetic-test-model')
        save_json(self.d/'spec.json',{});save_json(self.d/'report.json',{})
        self.manifest={'id':'test','displayName':'test','validationStatus':'passed','reviewStatus':'review-candidate','visualApproval':'pending','model':{'path':'model.glb','sha256':self.hash},'sourceViews':{},'reconstructionSpec':'spec.json','validationReport':'report.json'}
        save_json(self.d/'manifest.json',self.manifest);self.state=initialize(self.d,self.hash)
        self.assessment={'schemaVersion':'rinne.forge-quality-assessment/v1','reviewer':'test-only','modelSha256':self.hash,'reviewedViews':list(VIEWS),'decision':'revise','checklist':{c:{'result':'unverified','notes':'contract test only'} for c in CHECKS},'findings':[{'id':'f1','target':'torso','observed':'side insufficient','expected':'source contour','preserve':'rig','views':['side']}]}
    def tearDown(self):self.temp.cleanup()
    def record(self):
        Image.new('RGBA',(2,2),'white').save(self.d/'test.png');(self.d/'test.blend').write_bytes(b'test-only');save_json(self.d/'dcc.json',{})
        record=lambda name:{'path':name,'sha256':digest((self.d/name).read_bytes())}
        round0={'round':0,'sourceSha':'a'*40,'modelSha256':self.hash,'specSha256':digest((self.d/'spec.json').read_bytes()),'captures':{v:record('test.png') for v in VIEWS},'blend':record('test.blend'),'dcc':record('dcc.json'),'identityReferences':{},'qualityReferences':[],'comparisons':{},'changedVertices':0,'renderer':'MOCK: contract test only'}
        round0['captureSetSha256']=digest(json.dumps(round0,sort_keys=True).encode());self.state['rounds']=[round0];self.state['status']='awaiting-review';save_json(self.d/STATE_PATH,self.state);self.assessment['captureSetSha256']=round0['captureSetSha256']
    def submit(self):
        path=self.root/'assessment.json';save_json(path,self.assessment);return assess(self.root,'test',path)
    def test_numeric_success_does_not_finish(self):
        self.assertEqual(self.state['status'],'awaiting-capture')
        with self.assertRaises(ValueError):self.submit()
    def test_stale_and_tampered_captures_rejected(self):
        self.record();self.assessment['modelSha256']='b'*64
        with self.assertRaises(ValueError):self.submit()
        self.assessment['modelSha256']=self.hash;(self.d/'test.png').write_bytes(b'changed')
        with self.assertRaises(ValueError):self.submit()
    def test_findings_enter_repair_not_approval(self):
        self.record();result=self.submit();self.assertEqual(result['status'],'needs-dcc-correction');self.assertFalse(result['productionReady']);self.assertEqual(result['visualApproval'],'pending')
        self.assertIn('refinementUrl', (self.root/'packages/assets/generated/create-forge-registry.js').read_text())
        with self.assertRaises(ValueError):self.submit()
    def test_missing_quality_reference_blocks_readiness(self):
        self.record();self.assessment.update(decision='ready-for-human-review',findings=[],checklist={c:{'result':'pass','notes':'test'} for c in CHECKS})
        with self.assertRaisesRegex(ValueError,'quality references'):self.submit()
    def test_worker_cannot_approve(self):
        self.record();self.assessment['decision']='approved'
        with self.assertRaises(ValueError):self.submit()
    def test_paths_and_stale_registry_fail_closed(self):
        with self.assertRaises(ValueError):inside(self.d,'../../../../escape')
        register_review(self.root);(self.d/'model.glb').write_bytes(b'changed')
        with self.assertRaises(ValueError):register_review(self.root)

if __name__=='__main__':unittest.main()
