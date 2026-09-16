const PHASES=new Set(['jo','ha','kyu']);

export function nextCombatReadoutState(previous={},action='',phase=''){
  const nextAction=String(action||'').trim();
  const nextPhase=PHASES.has(phase)?phase:'';
  const priorAction=String(previous.action||'').trim();
  const priorPhase=PHASES.has(previous.phase)?previous.phase:'';
  return{
    action:nextAction,
    phase:nextPhase,
    actionChanged:nextAction!==priorAction,
    phaseChanged:nextPhase!==priorPhase,
  };
}
