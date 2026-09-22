import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEV_APP_NAMES } from './application-catalog.mjs';
import { distributionPublicUrl } from './distribution-targets.mjs';
import { PERSONAL_DEV_EMAIL_REPOSITORY, findAssociatedDevelopPr, personalDevChangeSummary, recordGithubDeliveryReceipt } from './notify-delivery.mjs';
import { refreshPulseState } from '../ops-board/refresh-client.mjs';

const SHA=/^[a-f0-9]{40}$/;
const PULSE_PUBLIC_URL='https://rinne-ops.c-okamoto.workers.dev/';
const REVIEW_SURFACE_NAMES=Object.freeze({
  '/review-motion':'モーション確認',
  '/review-assets':'素材確認',
  '/review-objects':'オブジェクト確認',
  '/review-effects':'エフェクト確認',
  '/review-sound':'サウンド確認',
  '/review-battle':'戦闘確認',
});

function reviewSurfaceName(pr){
  const source=`${pr?.title||''}\n${pr?.body||''}`;
  return Object.entries(REVIEW_SURFACE_NAMES).find(([route])=>source.includes(route))?.[1]||'';
}
function compact(text,max=160){
  const value=String(text||'').replace(/\s+/g,' ').trim();
  return value.length>max?value.slice(0,max-1)+'…':value;
}

export function fastDevEmailMessage({pr,repository,apps=[]}={}){
  if(!pr?.number||!apps.length)return null;
  const {label,description}=personalDevChangeSummary(pr);
  const appNames=[...new Set(apps.map(app=>DEV_APP_NAMES[app]||app))];
  const surface=reviewSurfaceName(pr);
  const context=[...appNames,...(surface?[surface]:[])].join(' / ');
  const targets=apps.map(app=>`${DEV_APP_NAMES[app]||app}: ${distributionPublicUrl('web-dev',app)}`);
  return [
    `DEV反映完了【${context}】`,
    `反映内容: ${compact(label)}`,
    ...(description?[`概要: ${compact(description)}`]:[]),
    `PR: #${pr.number}`,
    ...targets.map(target=>`確認先: ${target}`),
    `確認・報告: https://github.com/${repository}/pull/${pr.number}`,
  ].join('\n');
}

export async function notifyFastDev({token='',repository=PERSONAL_DEV_EMAIL_REPOSITORY,sha,apps=[],request=fetch}={}){
  if(!token)return 'not-configured';
  if(repository!==PERSONAL_DEV_EMAIL_REPOSITORY||!SHA.test(String(sha||'')))throw new Error('INVALID_FAST_DEV_NOTIFICATION');
  const pr=await findAssociatedDevelopPr({token,repository,sha,request});
  if(!pr)return 'no-associated-pr';
  const message=fastDevEmailMessage({pr,repository,apps});
  if(!message)return 'no-apps';
  return recordGithubDeliveryReceipt({token,repository,sha,message,pr,request});
}

async function main(){
  const [sha,appsJson='[]']=process.argv.slice(2),apps=JSON.parse(appsJson);
  const token=process.env.GITHUB_TOKEN||'';
  const receipt=await notifyFastDev({token,repository:process.env.GITHUB_REPOSITORY||'',sha,apps});
  console.log(`Fast DEV email receipt: ${receipt}`);
  let pulseRefresh='skipped';
  if(token){
    try{
      const state=await refreshPulseState({baseUrl:PULSE_PUBLIC_URL,refreshToken:token,githubToken:token,reason:'deployment'});
      pulseRefresh=state?.generatedAt||'ok';
      console.log(`PULSE_REFRESH_OK generatedAt=${pulseRefresh}`);
    }catch(error){
      pulseRefresh='failed';
      console.log(`::warning::PULSE refresh after DEV publication failed: ${error.message}`);
      if(apps.includes('pulse')) throw error;
    }
  }
  if(process.env.GITHUB_OUTPUT){
    const {appendFileSync}=await import('node:fs');
    appendFileSync(process.env.GITHUB_OUTPUT,`receipt=${receipt}\npulse_refresh=${pulseRefresh}\n`);
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
