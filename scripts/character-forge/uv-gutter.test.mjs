import test from 'node:test';
import assert from 'node:assert/strict';
import {chartGutterPlan,applyChartGutter,auditBilinearSupport} from '../../packages/assets/forge/uv_chart_gutter.js';
test('bilinear support covers every triangle edge without crossing chart ownership',()=>{
  // Fractional cell boundaries reproduce the production atlas allocation.
  const size=64,cells=7,triangles=47,cell=size/cells,pixels=new Uint8Array(size*size*4),uv=[];
  for(let t=0;t<triangles;t++){
    const x=t%cells*cell,y=Math.floor(t/cells)*cell,p=1.5;
    uv.push((x+p)/size,(y+p)/size,(x+cell-p)/size,(y+p)/size,(x+p)/size,(y+cell-p)/size);
    for(let yy=Math.ceil(y+p-.5);yy+.5<y+cell-p;yy++)for(let xx=Math.ceil(x+p-.5);xx+.5<x+cell-p;xx++)
      if(xx+.5-x-p+yy+.5-y-p<cell-2*p)pixels.set([t+1,13,17,191],(yy*size+xx)*4);
  }
  const before=pixels.slice();assert.throws(()=>auditBilinearSupport(pixels,size,uv),/missing support/);
  const plan=chartGutterPlan(pixels,size,cells,triangles);applyChartGutter(pixels,plan);
  assert.equal(auditBilinearSupport(pixels,size,uv).missing,0);
  for(let i=0;i<size*size;i++){
    const owner=Math.floor((Math.floor(i/size)+.5)/cell)*cells+Math.floor((i%size+.5)/cell);
    if(owner<triangles)assert.equal(pixels[i*4],owner+1,'neighbor chart contaminated the gutter');
    if(before[i*4+3])assert.deepEqual(pixels.subarray(i*4,i*4+3),before.subarray(i*4,i*4+3));
  }
});
test('a chart without rasterized source data fails loudly',()=>{
  assert.throws(()=>chartGutterPlan(new Uint8Array(16*16*4),16,2,3),/No rasterized texels/);
});
