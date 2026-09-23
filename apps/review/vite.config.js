import { appConfig } from '../../scripts/vite-app.mjs';
import {fileURLToPath} from 'node:url';

const config=appConfig('review',import.meta.url);
config.build.rolldownOptions={input:{
  main:fileURLToPath(new URL('./index.html',import.meta.url)),
  forge:fileURLToPath(new URL('./review-character-forge.html',import.meta.url)),
  camera:fileURLToPath(new URL('./review-camera.html',import.meta.url)),
  hybrid25d:fileURLToPath(new URL('./review-hybrid-25d.html',import.meta.url)),
  battle2:fileURLToPath(new URL('./battle2.html',import.meta.url)),
}};
export default config;

