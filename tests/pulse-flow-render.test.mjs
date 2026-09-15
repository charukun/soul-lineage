import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../ops-board/public/flow-board.js',import.meta.url),'utf8').replace(/^import .*;\n/,'');
class Element {
  children=[]; value=''; className='';
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;this.value='';}
  set textContent(value){this.value=String(value);this.children=[];}
  get textContent(){return [this.value,...this.children.map(child=>child.textContent)].filter(Boolean).join(' ');}
}
function render(state){
  const root=new Element();
  runInNewContext(source,{
    document:{querySelector:()=>root,createElement:()=>new Element()},
    subscribe:fn=>fn(state),
    disclosure:(_key,_label,content)=>content,
  });
  return root;
}
const fixture=(queue=[],rescue={})=>({integration:{queue},integrationRescue:rescue,environments:[{id:'dev',deployState:'success',deployQueue:{commitsAhead:0}}]});

test('current Ready and fast-check counts exclude Draft and legacy planner backlog',()=>{
  const root=render(fixture([
    {stage:'READY_WAIT',label:'作業中'},
    {stage:'READY_WAIT',label:'自動テスト待ち'},
    {stage:'READY_RECONCILE'},
    {stage:'HOLD'},
  ],{flowControl:{reconciliation:{totalReady:18,counts:{repair:7}}}}));
  const current=root.children[0].textContent;
  assert.match(current,/Ready 3件/);
  assert.match(current,/FAST CHECK 1件/);
  assert.match(current,/MERGE LANE 1件/);
  assert.match(current,/明示保留は 1件/);
  assert.doesNotMatch(current,/18|旧Reconciliation/);
  assert.match(root.children[1].textContent,/旧Reconciliation診断: Ready 18/);
});

test('failed current checks stay visible while independent merge-ready work can proceed',()=>{
  const root=render(fixture([{stage:'CI_FAILED'},{stage:'READY_RECONCILE'}]));
  assert.match(root.children[0].textContent,/Fast Lane処理中/);
  assert.match(root.children[0].textContent,/失敗 1件.*対象PRの修復待ち/);
  assert.match(render(fixture([{stage:'CI_FAILED'}])).children[0].textContent,/Fast checkに失敗あり/);
});

test('configuration failure cannot contradict the repair lane with an operations-not-required message',()=>{
  const text=render(fixture([],{status:'CONFIGURATION_REQUIRED',humanManual:[]})).children[0].textContent;
  assert.match(text,/設定確認が必要/);
  assert.doesNotMatch(text,/あなたの操作は不要|ALL CLEAR/);
});

test('legacy idle evidence stays diagnostic without promising the obsolete reconciler will run',()=>{
  const root=render(fixture([],{flowControl:{reconciliation:{actionableIdle:true,counts:{repair:2}}}}));
  assert.doesNotMatch(root.children[0].textContent,/稼働executor|次のreconcile/);
  assert.match(root.children[1].textContent,/旧診断では修復待ち.*稼働executorが0/);
  assert.doesNotMatch(root.textContent,/次のreconcileで再配分/);
});
