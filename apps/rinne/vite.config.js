import { appConfig } from '../../scripts/vite-app.mjs';
import {fileURLToPath} from 'node:url';
const config=appConfig('rinne',import.meta.url);
config.build.rolldownOptions={input:{main:fileURLToPath(new URL('./index.html',import.meta.url)),characters:fileURLToPath(new URL('./characters.html',import.meta.url)),rehearsal:fileURLToPath(new URL('./village-rehearsal.html',import.meta.url))}};
export default config;
