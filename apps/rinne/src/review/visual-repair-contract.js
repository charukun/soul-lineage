export const VISUAL_REPAIR_VERSION = 1;

export const VISUAL_REPAIR_RUBRIC = Object.freeze([
  Object.freeze({id:'form', label:'Form & silhouette', max:3, guidance:'Proportion, silhouette, geometry, volume and major shape match.'}),
  Object.freeze({id:'identity', label:'Identity & features', max:2, guidance:'Face, hair, costume language and character-defining features.'}),
  Object.freeze({id:'materials', label:'Materials', max:2, guidance:'Color, texture, roughness, translucency and surface continuity.'}),
  Object.freeze({id:'intersections', label:'Intersections & detail', max:1, guidance:'Clipping, seams, joins, missing accents and fine visible differences.'}),
  Object.freeze({id:'presentation', label:'Presentation', max:1, guidance:'Lighting and framing differences that materially affect comparability.'}),
  Object.freeze({id:'deformation', label:'Pose & deformation', max:1, guidance:'Pose readability, rig deformation and task-relevant shape under motion.'})
]);

const clean=value=>String(value??'').trim();
const cleanList=value=>Array.isArray(value)?value.map(clean).filter(Boolean).slice(0,24):[];
const fenced=/^```(?:json)?\s*([\s\S]*?)\s*```$/i;

function contextLines(context={}) {
  return [
    ['model', context.model],
    ['motion', context.motion],
    ['view', context.view],
    ['build', context.build],
    ['reference note', context.note]
  ].filter(([,value])=>clean(value)).map(([key,value])=>`${key}: ${clean(value)}`).join('\n');
}

export function buildVisualRepairPrompt(context={}) {
  const details=contextLines(context);
  return `Repository: charukun/soul-lineage\n\nVisual Repair request from Visual Review Lab.\n\nThe attached comparison sheet is authoritative: TARGET is the desired appearance and CURRENT is the runtime capture that must be improved. ${details?`\n${details}\n`:''}\nUse latest develop and the current GitHub state as source of truth. Follow AGENTS.md, run context:plan when a checkout is available, and read only the required art/model contracts. Create the normal short-lived implementation branch and Draft PR before implementation edits.\n\nRepair the actual production model/source consumed by the game. Do not fake improvement with Lab-only lighting, camera changes, screenshots, overlays, primitive stand-ins or a separate review-only asset. Preserve existing rig/runtime compatibility, sockets, gameplay contracts, approved regions, provenance and performance gates. If the reference requires a substantial geometric rebuild, make the necessary real asset changes rather than stopping at cosmetic tweaks.\n\nIterate aggressively: compare the reference and delivered runtime result, fix the highest-impact visible gap, render/capture the real delivered asset again, and continue until no material high-impact mismatch remains or a true semantic/human decision is required. Passing tests or export alone is not visual proof, and AI self-scoring is diagnostic only; human visual approval remains separate.\n\nDo not use Fal, fal.ai, FAL_KEY, FAL_API_KEY, queue.fal.run, or any external image-to-3D generation API. Do not add a hidden AI backend, API key, paid generation path or automatic external upload. The reference image may be used only as the visual target supplied in this session.\n\nValidate the affected app/assets with the repository's fast checks, push the same implementation branch, mark the normal PR Ready only when implementation is complete, and hand it to Integration per repository policy. Do not change main or Production.\n\nIn the final handoff, state exactly what production asset/source changed, what runtime visual evidence was compared, remaining visible differences, branch/head/PR, and checks actually run.`;
}

export function buildVisualJudgePrompt(context={}) {
  const details=contextLines(context);
  const rubric=VISUAL_REPAIR_RUBRIC.map(row=>`- ${row.label} (0-${row.max}): ${row.guidance}`).join('\n');
  return `You are an independent visual comparison judge for 輪廻転焦 Visual Review Lab.\n\nThe attached sheet contains TARGET and CURRENT. Judge only what is visibly supported by the sheet. Do not reward implementation effort, tests, export success or hidden claims. Use the repository-oriented rubric below and keep criticism actionable. Human approval is separate from this diagnostic score.\n${details?`\n${details}\n`:''}\n${rubric}\n\nReturn ONLY one JSON object, without a markdown fence, using this exact shape:\n{\n  "version": ${VISUAL_REPAIR_VERSION},\n  "scores": {\n    "form": 0,\n    "identity": 0,\n    "materials": 0,\n    "intersections": 0,\n    "presentation": 0,\n    "deformation": 0\n  },\n  "summary": "short verdict",\n  "blockers": ["specific visible gap and correction"],\n  "next_actions": ["highest-impact correction first"],\n  "preserve": ["already-correct visible area or contract not to regress"]\n}\n\nFractional scores are allowed. Do not provide a total; the Lab computes it. If TARGET and CURRENT are not comparable enough to score reliably, score conservatively and describe the comparability problem in blockers.`;
}

export function parseVisualJudgeResult(value) {
  let text=clean(value);
  const match=text.match(fenced);
  if(match)text=match[1];
  let data;
  try{data=JSON.parse(text);}catch{throw new Error('判定JSONを読み取れません。JSONオブジェクトだけを貼り付けてください。');}
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('判定結果はJSONオブジェクトである必要があります。');
  if(Number(data.version)!==VISUAL_REPAIR_VERSION)throw new Error(`判定versionは${VISUAL_REPAIR_VERSION}を指定してください。`);
  if(!data.scores||typeof data.scores!=='object'||Array.isArray(data.scores))throw new Error('scoresがありません。');
  const scores={};
  for(const row of VISUAL_REPAIR_RUBRIC){
    const score=Number(data.scores[row.id]);
    if(!Number.isFinite(score)||score<0||score>row.max)throw new Error(`${row.label}は0〜${row.max}で指定してください。`);
    scores[row.id]=Math.round(score*100)/100;
  }
  const total=Math.round(Object.values(scores).reduce((sum,score)=>sum+score,0)*100)/100;
  return Object.freeze({
    version:VISUAL_REPAIR_VERSION,
    scores:Object.freeze(scores),
    total,
    summary:clean(data.summary).slice(0,600),
    blockers:Object.freeze(cleanList(data.blockers)),
    nextActions:Object.freeze(cleanList(data.next_actions)),
    preserve:Object.freeze(cleanList(data.preserve))
  });
}

export function visualJudgeResultText(result) {
  const scores=VISUAL_REPAIR_RUBRIC.map(row=>`${row.label} ${result.scores[row.id]}/${row.max}`).join(' / ');
  const section=(label,rows)=>rows.length?`\n${label}:\n${rows.map(row=>`- ${row}`).join('\n')}`:'';
  return `Visual Judge ${result.total}/10\n${scores}${result.summary?`\n${result.summary}`:''}${section('Blockers',result.blockers)}${section('Next',result.nextActions)}${section('Preserve',result.preserve)}`;
}
