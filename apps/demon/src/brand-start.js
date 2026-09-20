import {openBrandBootGate} from '@soul/shared-ui/boot-gate';
await openBrandBootGate({app:'demon'});
await import('./main.js');
