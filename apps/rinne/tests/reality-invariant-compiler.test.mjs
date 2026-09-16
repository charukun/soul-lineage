import test from 'node:test';
import assert from 'node:assert/strict';
import {compileInvariantCoordination,proveCompiledSemanticFrontier,proveInvariantCompilerKernel,verifyInvariantCoordinationCertificate} from '../src/game/reality-lab/invariant-compiler.js';

test('bounded invariant compiler emits witness-backed minimal coordination edges',()=>{
  const proof=proveInvariantCompilerKernel();assert.equal(proof.pass,true);assert.equal(proof.checks.witnessMinimal,true);assert.equal(proof.checks.growOnlySafe,true);assert.equal(proof.checks.conservativeEscalation,true);assert.equal(proof.checks.certificateValid,true);assert.equal(proof.checks.tamperRejected,true);
  assert.ok(proof.compiled.conflicts.every(row=>row.witnesses.length>0));
});

test('two independently valid reservations expose the exact stock underflow witness',()=>{
  const compiled=compileInvariantCoordination({resources:[{id:'stock',type:'bounded-counter',min:0,max:2}],operations:[{id:'a',effects:{stock:{delta:-1}}},{id:'b',effects:{stock:{delta:-1}}}]});
  assert.equal(compiled.conflicts.length,1);const witness=compiled.conflicts[0].witnesses[0];assert.equal(witness.base,1);assert.equal(witness.left,0);assert.equal(witness.right,0);assert.equal(witness.merged,-1);assert.equal(compiled.semanticOperations.every(op=>op.requiresTotalOrder&&!op.rollbackAllowed),true);
});

test('grow-only merge stays coordination-free while conflicting unique assignment does not',()=>{
  const compiled=compileInvariantCoordination({resources:[{id:'tags',type:'grow-only-set'},{id:'name',type:'unique-register'}],operations:[{id:'tag-a',effects:{tags:{add:'a'}}},{id:'tag-b',effects:{tags:{add:'b'}}},{id:'name-a',effects:{name:{assign:'A'}}},{id:'name-b',effects:{name:{assign:'B'}}}]});
  assert.ok(compiled.safePairs.some(row=>row.key==='tag-a::tag-b'));assert.ok(compiled.conflicts.some(row=>row.key==='name-a::name-b'));assert.equal(verifyInvariantCoordinationCertificate(compiled.certificate),true);
});

test('compiled Semantic Frontier never routes witnessed conflicts through weak merge paths',()=>{
  const proof=proveCompiledSemanticFrontier();assert.equal(proof.pass,true);assert.equal(proof.hasPlan,true);assert.equal(proof.unsafeNeverWeak,true);assert.equal(proof.mergeableCanStayWeak,true);assert.ok(proof.frontierPoints>0);
});
