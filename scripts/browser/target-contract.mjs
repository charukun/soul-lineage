/** Keep DEV and Production gates scoped to their existing workflow stages. */
export function selectBrowserTargets(entries, {changed=[], ref='', full=false}={}) {
  const environment = full || ref==='refs/heads/develop' ? 'dev' : ref==='refs/heads/main' ? 'prod' : null;
  const available=entries.filter(e=>!environment||e.environment===environment);
  const selected=available.filter(e=>full||changed.includes(e.path));
  // Integration invokes this stage when public verification is required. A
  // retry can reuse already-published assets after a failed browser gate; an
  // empty build delta is not evidence that those assets passed the browser.
  if(ref==='refs/heads/develop'&&!selected.length){
    if(!available.length)throw new Error('No DEV browser targets in the publication manifest');
    return available;
  }
  return selected;
}
