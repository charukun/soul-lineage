import { appConfig } from '../../scripts/vite-app.mjs';
import {fileURLToPath} from 'node:url';
const config=appConfig('rinne',import.meta.url);
config.build.rolldownOptions={input:{main:fileURLToPath(new URL('./index.html',import.meta.url)),review:fileURLToPath(new URL('./review.html',import.meta.url)),characters:fileURLToPath(new URL('./characters.html',import.meta.url)),charactersAdvanced:fileURLToPath(new URL('./characters-advanced.html',import.meta.url)),realityLab:fileURLToPath(new URL('./reality-lab.html',import.meta.url))}};
export default config;
