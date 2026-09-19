import {fileURLToPath} from 'node:url';
import {appConfig} from '../../scripts/vite-app.mjs';
const config=appConfig('character-studio',import.meta.url);
config.build.rolldownOptions={input:{
  main:fileURLToPath(new URL('./index.html',import.meta.url)),
  advanced:fileURLToPath(new URL('./advanced.html',import.meta.url)),
}};
export default config;
