import { appConfig } from '../../scripts/vite-app.mjs';
import {fileURLToPath} from 'node:url';

const config=appConfig('rinne',import.meta.url);
config.build.rolldownOptions={input:{main:fileURLToPath(new URL('./index.html',import.meta.url)),review:fileURLToPath(new URL('./review.html',import.meta.url)),reviewMotion:fileURLToPath(new URL('./review/motion/index.html',import.meta.url)),reviewAssets:fileURLToPath(new URL('./review/equipment/index.html',import.meta.url)),reviewObjects:fileURLToPath(new URL('./review/objects/index.html',import.meta.url)),reviewEffects:fileURLToPath(new URL('./review/effects/index.html',import.meta.url)),reviewSound:fileURLToPath(new URL('./review/sound/index.html',import.meta.url)),realityLab:fileURLToPath(new URL('./reality-lab.html',import.meta.url))}};
export default config;
