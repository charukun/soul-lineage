import {sharedEmblemUrl} from '@soul/assets';
import { mountTitle } from './title/controller.js';

// Build information is injected by the existing monorepo Vite plugin. A standalone
// preview must never claim to be a deployed commit.
const info = typeof __BUILD_INFO__ !== 'undefined' ? __BUILD_INFO__ : {
  name:'輪廻転焦',app:'rinne',environment:'local',commit:'UNBUILT',inputHash:null,
};
const dispose = mountTitle(info,{emblemURL:sharedEmblemUrl});
if (import.meta.hot) import.meta.hot.dispose(dispose);
