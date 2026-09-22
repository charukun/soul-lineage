import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveTechniquePresentation,techniquePresentationEffectIds} from '../src/technique-presentation.js';

test('technique presentation resolves complete motion, contact, VFX, SFX and camera metadata',()=>{
  const row=resolveTechniquePresentation({techniqueId:'generated.sword.test',weapon:'sword',phase:'ha',steps:[{kind:'thrust',footwork:'forward'},{kind:'back',footwork:'sideR'}]});
  assert.equal(row.motion.segments.length,2);
  assert.equal(row.motion.segments[0].clipRole,'oneHandStab');
  assert.equal(row.motion.segments[0].rootMotion,'locked');
  assert.ok(row.contact.hitRatio>0&&row.contact.hitRatio<1);
  assert.ok(row.vfx.trail.effect&&row.vfx.impact.effect);
  assert.ok(row.sfx.swing.role&&Number.isFinite(row.sfx.swing.pitch));
  assert.ok(Number.isFinite(row.camera.executionFov)&&Number.isFinite(row.camera.shake));
  assert.equal(Object.isFrozen(row),true);
});

test('authored technique ID overrides generic weapon metadata without changing technique steps',()=>{
  const row=resolveTechniquePresentation({techniqueId:'spark.great.anchor',weapon:'great',phase:'kyu',grade:'secret',steps:[{kind:'pommel'},{kind:'heavy',footwork:'forward',charge:'breath'}]});
  assert.equal(row.camera.preset,'weight-drop');
  assert.equal(row.sfx.impact.role,'weight-impact');
  assert.equal(row.vfx.impact.scale,1.34);
  assert.equal(row.motion.segments[1].kind,'heavy');
  assert.equal(row.motion.segments[1].charge,'breath');
  assert.equal(row.grade,'secret');
});

test('presentation effect IDs are concrete registered effect keys',()=>{
  assert.deepEqual([...techniquePresentationEffectIds()].sort(),['impact','lib-effectmaterials-parts-hit01','lib-tktk01-light1','slash'].sort());
});


test('optional motion variation replaces authored clip playback without changing structural contact semantics',()=>{
  const input={techniqueId:'gen2.spear.thrust~forward',weapon:'spear',phase:'ha',steps:[{kind:'thrust',footwork:'forward'}]};
  const base=resolveTechniquePresentation(input);
  const varied=resolveTechniquePresentation({...input,motionVariation:{id:'dragon-fang',clips:[{segment:0,clipId:'technique/dragon-fang-thrust',sampleStart:.12,sampleEnd:.86,speed:.94}]}});
  assert.equal(varied.motion.variationId,'dragon-fang');
  assert.equal(varied.motion.segments[0].clipId,'technique/dragon-fang-thrust');
  assert.equal(varied.motion.segments[0].kind,base.motion.segments[0].kind);
  assert.deepEqual(varied.contact,base.contact);
});

test('secret and ultimate motion variations can be grade gated and safely fall back',()=>{
  const variation={id:'secret-body-form',minimumGrade:'secret',clips:[{clipId:'technique/secret-body-form'}]};
  const normal=resolveTechniquePresentation({weapon:'sword',grade:'normal',steps:[{kind:'slash'}],motionVariation:variation});
  const secret=resolveTechniquePresentation({weapon:'sword',grade:'secret',steps:[{kind:'slash'}],motionVariation:variation});
  assert.equal(normal.motion.variationId,null);
  assert.equal(normal.motion.segments[0].clipId,undefined);
  assert.equal(secret.motion.variationId,'secret-body-form');
  assert.equal(secret.motion.segments[0].clipId,'technique/secret-body-form');
});
