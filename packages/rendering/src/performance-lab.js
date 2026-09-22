const finite = value => typeof value === 'number' && Number.isFinite(value);

// Fixed storage: sampling never shifts a rolling window or computes percentiles.
class MetricWindow {
  constructor(capacity) { this.values=new Float64Array(capacity);this.reset(); }
  reset() { this.cursor=0;this.size=0;this.cached=null; }
  push(value) { this.values[this.cursor]=value;this.cursor=(this.cursor+1)%this.values.length;this.size=Math.min(this.size+1,this.values.length);this.cached=null; }
  stats() {
    if(this.cached)return this.cached;
    const values=new Array(this.size),start=(this.cursor-this.size+this.values.length)%this.values.length;
    for(let i=0;i<this.size;i++)values[i]=this.values[(start+i)%this.values.length];
    const average=this.size?values.reduce((a,b)=>a+b,0)/this.size:null;
    values.sort((a,b)=>a-b);
    const at=p=>this.size?values[Math.min(this.size-1,Math.max(0,Math.ceil(this.size*p)-1))]:null;
    return this.cached={average,p50:at(.5),p95:at(.95),p99:at(.99)};
  }
}

export function createPerformanceRecorder({ label = 'runtime', maxSamples = 1800, snapshotOnSample = true } = {}) {
  if(!Number.isInteger(maxSamples)||maxSamples<1)throw new Error('Invalid performance sample capacity');
  const windows=Array.from({length:7},()=>new MetricWindow(maxSamples));
  const [frames,gpu,calls,triangles,memory,transparentCalls,transparentTriangles]=windows;
  let longFrames=0,startedAt=Date.now();
  const record=(window,value,positive=false)=>{if(finite(value)&&(positive?value>0:value>=0))window.push(value);};
  const summary=window=>{const s=window.stats();return{average:s.average,p95:s.p95};};
  return {
    sample({frameMs,gpuMs=null,drawCalls=null,triangles:tris=null,textureBytes=null,transparentDrawCalls=null,transparentTriangleUpperBound=null}={}) {
      record(frames,frameMs,true);if(finite(frameMs)&&frameMs>50)longFrames++;
      record(gpu,gpuMs);record(calls,drawCalls);record(triangles,tris);record(memory,textureBytes);record(transparentCalls,transparentDrawCalls);record(transparentTriangles,transparentTriangleUpperBound);
      return snapshotOnSample?this.snapshot?.():undefined;
    },
    snapshot() {
      const f=frames.stats(),g=gpu.stats();
      return Object.freeze({label,startedAt,samples:frames.size,
        frame:{averageMs:f.average,p50Ms:f.p50,p95Ms:f.p95,p99Ms:f.p99,longFrames},
        gpu:{averageMs:g.average,p95Ms:g.p95,samples:gpu.size},
        drawCalls:summary(calls),triangles:summary(triangles),textureBytes:summary(memory),
        transparency:{drawCalls:summary(transparentCalls),triangleUpperBound:summary(transparentTriangles)},
      });
    },
    reset() { for(const window of windows)window.reset();longFrames=0;startedAt=Date.now(); },
  };
}

export function comparePerformanceSnapshots(baseline, current, {
  frameP95Ratio = 1.12,
  gpuP95Ratio = 1.15,
  drawCallRatio = 1.12,
  triangleRatio = 1.18,
  textureRatio = 1.15,
  transparencyDrawCallRatio = 1.18,
  transparencyTriangleRatio = 1.22,
  longFrameDelta = 3,
} = {}) {
  const regressions = [], warnings = [];
  const ratioCheck = (name, before, after, limit, severity = 'error') => {
    if (!finite(before) || before <= 0 || !finite(after)) return;
    const ratio = after / before;
    if (ratio > limit) (severity === 'error' ? regressions : warnings).push({ metric: name, baseline: before, current: after, ratio, limit });
  };
  ratioCheck('frame.p95Ms', baseline?.frame?.p95Ms, current?.frame?.p95Ms, frameP95Ratio);
  ratioCheck('gpu.p95Ms', baseline?.gpu?.p95Ms, current?.gpu?.p95Ms, gpuP95Ratio);
  ratioCheck('drawCalls.p95', baseline?.drawCalls?.p95, current?.drawCalls?.p95, drawCallRatio);
  ratioCheck('triangles.p95', baseline?.triangles?.p95, current?.triangles?.p95, triangleRatio, 'warning');
  ratioCheck('textureBytes.p95', baseline?.textureBytes?.p95, current?.textureBytes?.p95, textureRatio, 'warning');
  ratioCheck('transparency.drawCalls.p95', baseline?.transparency?.drawCalls?.p95, current?.transparency?.drawCalls?.p95, transparencyDrawCallRatio, 'warning');
  ratioCheck('transparency.triangleUpperBound.p95', baseline?.transparency?.triangleUpperBound?.p95, current?.transparency?.triangleUpperBound?.p95, transparencyTriangleRatio, 'warning');
  if (finite(baseline?.frame?.longFrames) && finite(current?.frame?.longFrames) && current.frame.longFrames - baseline.frame.longFrames > longFrameDelta) {
    regressions.push({ metric: 'frame.longFrames', baseline: baseline.frame.longFrames, current: current.frame.longFrames, delta: current.frame.longFrames - baseline.frame.longFrames, limit: longFrameDelta });
  }
  return Object.freeze({ pass: regressions.length === 0, regressions, warnings });
}
