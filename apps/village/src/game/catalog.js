// Canonical MURAAAAAAA data remains shared by all three games. The village
// presentation keeps its larger manor footprint locally, replacing the old
// post-boot mutation without changing the shared world contract.
export * from '@soul/world/mura/catalog';
import {BUILDINGS as canonicalBuildings,defs as canonicalDefs} from '@soul/world/mura/catalog';
export const BUILDINGS=canonicalBuildings.map(d=>d.id==='clanManor'?{...d,w:28,d:26}:d);
export const defs={...canonicalDefs,clanManor:{...canonicalDefs.clanManor,w:28,d:26}};
