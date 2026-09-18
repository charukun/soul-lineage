import { GAME_ENVIRONMENTS, INITIAL_ENVIRONMENT_APPS } from './application-catalog.mjs';

const consumer = (id, label, adapter) => Object.freeze({
  id, label, kind:'consumer', status:'contract-only', branch:null, environment:null,
  artifactFormat:'native-package', publisher:'platform-toolchain', adapter,
});

export const DISTRIBUTION_TARGETS = Object.freeze([
  Object.freeze({id:'web-dev',label:'Web DEV',kind:'web',status:'buildable',branch:'develop',environment:'dev',artifactFormat:'static-site',publisher:'compat-pages',preferredPublisher:'per-app-dev-host',adapter:'platform-web'}),
  Object.freeze({id:'web-review',label:'Visual Review',kind:'web-review',status:'buildable',branch:'develop',environment:'dev',artifactFormat:'static-site',publisher:'review-host',preferredPublisher:'per-app-review-host',adapter:'platform-web',apps:Object.freeze(['rinne'])}),
  Object.freeze({id:'web-staging',label:'Web Staging',kind:'web',status:'buildable',branch:'develop',environment:'staging',artifactFormat:'static-site',publisher:'compat-pages',adapter:'platform-web'}),
  Object.freeze({id:'web-prod',label:'Web Production',kind:'web',status:'buildable',branch:'main',environment:'prod',artifactFormat:'static-site',publisher:'compat-pages',adapter:'platform-web'}),
  consumer('steam','Steam','platform-steam'),
  consumer('android','Android','platform-android'),
  consumer('ios','iOS','platform-ios'),
  consumer('playstation','PlayStation','platform-playstation'),
  consumer('switch','Nintendo Switch','platform-switch'),
  consumer('xbox','Xbox','platform-xbox'),
]);

const byId=new Map(DISTRIBUTION_TARGETS.map(target=>[target.id,target]));
const byEnvironment=new Map(DISTRIBUTION_TARGETS.filter(target=>target.environment&&target.kind==='web').map(target=>[target.environment,target]));

export function distributionTarget(id){
  const target=byId.get(String(id||''));
  if(!target)throw new Error(`Unknown distribution target: ${id}`);
  return target;
}

export function webTargetForEnvironment(environment){
  const target=byEnvironment.get(String(environment||''));
  if(!target)throw new Error(`No web distribution target for environment: ${environment}`);
  return target;
}

export function targetSupportsApp(targetOrId,app){
  const target=typeof targetOrId==='string'?distributionTarget(targetOrId):targetOrId;
  return (!target.apps||target.apps.includes(app))&&INITIAL_ENVIRONMENT_APPS.includes(app);
}

export function assertBuildableTarget(targetOrId,app){
  const target=typeof targetOrId==='string'?distributionTarget(targetOrId):targetOrId;
  if(!targetSupportsApp(target,app))throw new Error(`Target ${target.id} does not support app ${app}`);
  if(target.status!=='buildable')throw new Error(`Target ${target.id} is contract-only; materialize ${target.adapter} and its official toolchain first`);
  return target;
}

export function distributionTargetSummary(){
  return DISTRIBUTION_TARGETS.map(target=>({id:target.id,kind:target.kind,status:target.status,branch:target.branch,environment:target.environment,adapter:target.adapter,publisher:target.publisher,preferredPublisher:target.preferredPublisher||target.publisher}));
}

export const DISTRIBUTION_ENVIRONMENTS=Object.freeze(GAME_ENVIRONMENTS.map(environment=>Object.freeze({
  ...environment,target:webTargetForEnvironment(environment.id).id,
})));
