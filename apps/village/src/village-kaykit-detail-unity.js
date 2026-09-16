import { createKaykitVillageDetailRuntime } from '@soul/rendering/mura/kaykit-detail';
import { THREE as T } from '@soul/rendering';
import { View } from './web/view.js';

const runtimes=new WeakMap(),cleanupByNode=new WeakMap(),rootURL=`${import.meta.env.BASE_URL}assets/vendor/kaykit-dungeon`;
const stableIndex=id=>{let hash=2166136261;for(const ch of String(id||'')){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;};
function runtime(view){if(!runtimes.has(view))runtimes.set(view,createKaykitVillageDetailRuntime({THREE:T,rootURL}));return runtimes.get(view);}
function decorate(view,node,object){if(!node||!object||node.userData?.kaykitDetailUnity)return node;node.userData.kaykitDetailUnity=true;cleanupByNode.set(node,runtime(view).attach(node,object,stableIndex(object.id)));return node;}
const originalNode=View.prototype.node;
View.prototype.node=function nodeWithSharedKayKitDetail(object){return decorate(this,originalNode.call(this,object),object);};
const active=window.village;if(active?.view&&active?.world){for(const [id,node] of active.view.objectNodes||[]){const object=active.world.object(id);if(object)decorate(active.view,node,object);}active.view.renderer.shadowMap.needsUpdate=true;}
window.__MURA_KAYKIT_DETAIL_UNITY__=Object.freeze({source:'@soul/rendering/mura/kaykit-detail',root:rootURL,installed:true});
