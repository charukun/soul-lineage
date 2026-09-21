#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ROOTS=new Set(['state','before','after']);

export function valueAt(root,path){
  assert.ok(root!==undefined&&root!==null,'evidence root is required');
  const parts=Array.isArray(path)?path:String(path||'').split('.').filter(Boolean);
  assert.ok(parts.length,'evidence path is required');
  let value=root;
  for(const key of parts){
    assert.ok(value!==null&&value!==undefined&&Object.hasOwn(Object(value),key),`missing evidence path: ${parts.join('.')}`);
    value=value[key];
  }
  return value;
}

function resolveRef(context,ref){
  assert.equal(typeof ref,'string','evidence reference must be a string');
  const [root,...parts]=ref.split('.');
  assert.ok(ROOTS.has(root),`evidence reference must start with state, before, or after: ${ref}`);
  return valueAt(context[root],parts);
}

function numeric(value,ref){
  assert.ok(typeof value==='number'&&Number.isFinite(value),`evidence value must be finite number: ${ref}`);
  return value;
}

function result(id,type,passed,actual,expected){
  return Object.freeze({id,type,passed,actual,expected});
}

export function evaluateEvidenceRelations({state=null,before=null,after=null,relations=[]}={}){
  assert.ok(Array.isArray(relations)&&relations.length>0,'at least one evidence relation is required');
  const context={state,before,after};
  const results=relations.map((relation,index)=>{
    const id=String(relation.id||`relation-${index+1}`);
    switch(relation.type){
      case 'equals':
      case 'unchanged':{
        const left=resolveRef(context,relation.left),right=resolveRef(context,relation.right);
        return result(id,relation.type,isDeepStrictEqual(left,right),left,right);
      }
      case 'sumEquals':{
        assert.ok(Array.isArray(relation.terms)&&relation.terms.length>0,`${id}: terms are required`);
        const target=numeric(resolveRef(context,relation.target),relation.target);
        const values=relation.terms.map(ref=>numeric(resolveRef(context,ref),ref));
        const expected=values.reduce((sum,value)=>sum+value,0);
        return result(id,relation.type,Object.is(target,expected),target,expected);
      }
      case 'textIncludesValue':{
        const text=String(resolveRef(context,relation.text));
        const value=resolveRef(context,relation.value);
        const expected=`${relation.prefix||''}${value}${relation.suffix||''}`;
        return result(id,relation.type,text.includes(expected),text,expected);
      }
      default: throw new Error(`${id}: unsupported evidence relation type: ${relation.type}`);
    }
  });
  return Object.freeze({
    schema:'soul-lineage.autonomous-evidence.v1',
    supported:results.every(row=>row.passed),
    results:Object.freeze(results),
  });
}

function option(args,name,fallback=null){
  const i=args.indexOf(name);
  return i>=0?args[i+1]:fallback;
}

async function main(){
  const args=process.argv.slice(2),command=args[0];
  if(command!=='check')throw new Error('Usage: node scripts/autonomous-evidence.mjs check --evidence <json> --contract <json>');
  const evidencePath=option(args,'--evidence'),contractPath=option(args,'--contract');
  if(!evidencePath||!contractPath)throw new Error('--evidence and --contract are required');
  const input=JSON.parse(readFileSync(evidencePath,'utf8')),contract=JSON.parse(readFileSync(contractPath,'utf8'));
  const checked=evaluateEvidenceRelations({
    state:input.state??input,
    before:input.before??null,
    after:input.after??null,
    relations:Array.isArray(contract)?contract:contract.relations,
  });
  process.stdout.write(JSON.stringify(checked,null,2)+'\n');
  if(!checked.supported)process.exitCode=2;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
