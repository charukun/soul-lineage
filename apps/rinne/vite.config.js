import { appConfig } from '../../scripts/vite-app.mjs';
import {fileURLToPath} from 'node:url';

const config=appConfig('rinne',import.meta.url);
const reviewNavigationEntries=new Set([
  '/characters.html',
  '/characters-advanced.html',
  '/review-motion.html',
  '/review-assets.html',
  '/review-effects.html',
  '/review-battle.html',
]);

config.plugins=[...(config.plugins||[]),{
  name:'rinne-review-navigation',
  transformIndexHtml:{
    order:'pre',
    handler(html,ctx){
      const path=ctx.path?.split('?')[0];
      if(!reviewNavigationEntries.has(path))return html;
      return {html,tags:[{tag:'script',attrs:{type:'module',src:'./src/review-navigation.js'},injectTo:'body'}]};
    },
  },
}];

config.build.rolldownOptions={input:{main:fileURLToPath(new URL('./index.html',import.meta.url)),review:fileURLToPath(new URL('./review.html',import.meta.url)),reviewMotion:fileURLToPath(new URL('./review-motion.html',import.meta.url)),reviewAssets:fileURLToPath(new URL('./review-assets.html',import.meta.url)),reviewEffects:fileURLToPath(new URL('./review-effects.html',import.meta.url)),reviewBattle:fileURLToPath(new URL('./review-battle.html',import.meta.url)),characters:fileURLToPath(new URL('./characters.html',import.meta.url)),charactersAdvanced:fileURLToPath(new URL('./characters-advanced.html',import.meta.url)),realityLab:fileURLToPath(new URL('./reality-lab.html',import.meta.url))}};
export default config;
