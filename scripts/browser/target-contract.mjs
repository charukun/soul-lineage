/** Keep DEV and Production gates scoped to their existing workflow stages. */
export function selectBrowserTargets(entries, {changed=[], ref='', full=false}={}) {
  const environment = full || ref==='refs/heads/develop' ? 'dev' : ref==='refs/heads/main' ? 'prod' : null;
  return entries.filter(e => (!environment || e.environment===environment) && (full || changed.includes(e.path)));
}
