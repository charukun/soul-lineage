import {openBrandBootGate} from '@soul/shared-ui/boot-gate';
await openBrandBootGate({app:'village'});
await import('./main.js');
