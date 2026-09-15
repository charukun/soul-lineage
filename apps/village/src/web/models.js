import {THREE} from '@soul/rendering';
import {createMuraModels} from '@soul/rendering/mura';
const models=createMuraModels(THREE,{createCanvas:()=>document.createElement('canvas')});
const T=THREE;
const material=color=>new T.MeshStandardMaterial({color,roughness:.95});
const workMaterials={
 wood:material(0x8c6848),trim:material(0x69563e),leaf:material(0x748b5f),
 gold:material(0xc5a460),stone:material(0x8f9388),cloth:material(0x8d9f91),clay:material(0x9b7d68)
};
function box(g,x,y,z,w,h,d,m){const n=new T.Mesh(new T.BoxGeometry(w,h,d),m);n.position.set(x,y,z);n.castShadow=n.receiveShadow=true;g.add(n);return n;}
function cylinder(g,x,y,z,r,h,m){const n=new T.Mesh(new T.CylinderGeometry(r,r,h,8),m);n.position.set(x,y,z);n.castShadow=n.receiveShadow=true;g.add(n);return n;}
function decorateWorkSite(g,kind){
 if(!g||g.userData.villageWorkSiteDetailed)return g;
 if(!['logging','storage','wheat','quarry','clay','carpenter','guardpost'].includes(kind))return g;
 g.userData.villageWorkSiteDetailed=true;
 if(kind==='logging')for(let i=0;i<5;i++){const log=cylinder(g,-2+(i%2)*.55,.35+Math.floor(i/2)*.5,-1.7+(i%2)*.62,.3,4.4,workMaterials.wood);log.rotation.z=Math.PI/2;}
 if(kind==='storage')for(const [x,z]of[[-2,-1],[0,-1],[2,-1],[-1,1],[1,1]])box(g,x,.55,z,1.5,1.1,1.5,workMaterials.wood);
 if(kind==='wheat')for(let z=-4;z<=4;z+=1.35)for(let x=-4;x<=4;x+=1.35)cylinder(g,x,.45,z,.04,.9,workMaterials.gold);
 if(kind==='quarry')for(const [x,z,s]of[[-2,-1,1.1],[1,-1,.9],[2,2,1.3],[-1,2,.7]]){const rock=new T.Mesh(new T.DodecahedronGeometry(s),workMaterials.stone);rock.position.set(x,s*.55,z);rock.castShadow=rock.receiveShadow=true;g.add(rock);}
 if(kind==='clay'){box(g,-1,.09,-1.4,7.5,.16,6,workMaterials.clay);for(const [x,z]of[[3.4,-2],[3.4,0],[3.4,2]])cylinder(g,x,.45,z,.55,.9,workMaterials.clay);}
 if(kind==='carpenter'){box(g,0,.85,-1,4.5,.45,1.5,workMaterials.wood);for(const x of[-1.7,1.7])box(g,x,1.7,-1,.18,1.8,.18,workMaterials.cloth);}
 if(kind==='guardpost'){box(g,0,2.2,0,.22,4.4,.22,workMaterials.wood);box(g,.65,3.4,0,1.3,.8,.08,workMaterials.cloth);}
 return g;
}
export const {mat,prop,person,interiorShell,floorFor,sailingShip,animal}=models;
export function building(kind,material='base',level=1){return decorateWorkSite(models.building(kind,material,level),kind);}
