// Canonical MURAAAAAAA data remains shared by all three games. The village
// presentation keeps compact residential tents and its larger manor footprint
// locally, without changing the shared world contract.
export * from '@soul/world/mura/catalog';
import {BUILDINGS as canonicalBuildings,defs as canonicalDefs} from '@soul/world/mura/catalog';
const compactTent={w:5,d:6};
const localize=d=>d.id==='clanManor'?{...d,w:28,d:26}:['mayor','guardhome','tent'].includes(d.id)?{...d,...compactTent}:d;
export const BUILDINGS=canonicalBuildings.map(localize);
export const defs={...canonicalDefs,mayor:{...canonicalDefs.mayor,...compactTent},guardhome:{...canonicalDefs.guardhome,...compactTent},tent:{...canonicalDefs.tent,...compactTent},clanManor:{...canonicalDefs.clanManor,w:28,d:26}};
