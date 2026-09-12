// Real-player villages are intentionally absent from the normal hunt flow.
// Friend invitations open the Village app's dedicated, non-hostile sightseeing entry instead.
// Keep this adapter as a no-op because older boot code still calls it.
export function installOnlineRaid(){return{enabled:false,reason:'friend-invite-only'};}
