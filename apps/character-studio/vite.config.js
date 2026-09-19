import {fileURLToPath} from 'node:url';
import {makeViteConfig} from '../../scripts/vite-app.mjs';
const config=makeViteConfig(import.meta.url,'character-studio');
config.build.rolldownOptions={input:{
  main:fileURLToPath(new URL('./index.html',import.meta.url)),
  advanced:fileURLToPath(new URL('./advanced.html',import.meta.url)),
}};
export default config;
