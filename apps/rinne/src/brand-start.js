import {openBrandBootGate} from '@soul/shared-ui/boot-gate';
await openBrandBootGate({app:'rinne'});
await import('./main.js');
