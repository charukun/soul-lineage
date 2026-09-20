import {openBrandBootGate} from '@soul/shared-ui/boot-gate';

const appReady=Promise.resolve().then(()=>import('./main.js'));
await openBrandBootGate({app:'demon',ready:appReady});
await appReady;
