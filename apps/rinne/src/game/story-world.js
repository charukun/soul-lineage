import {defaultMuraLayout,muraEntry,defs} from '@soul/world/mura';
/** Gameplay roles reference stable MURA entities, never a second village map. */
export function storyPlaces(layout=defaultMuraLayout()){
  const find=kinds=>layout.objects.find(o=>o.phase==='built'&&kinds.includes(o.kind));
  const home=find(['home','tent','clanManor','mayor']),square=find(['campfire'])||home;
  const place=(id,kinds,activity,verb)=>{const object=find(kinds)||square;return{id,entityId:object?.id||null,name:object?defs[object.kind].label:'村の広場',...(object?muraEntry(object):{x:0,z:0}),activity,verb};};
  return [
    place('home',['home','tent','clanManor','mayor'],'care','暮らしを手伝う'),
    place('school',['school','academy'],'study','文字を学ぶ'),
    place('library',['library','school'],'read','本を読む'),
    place('shrine',['shrine','temple'],'pray','祈りを捧げる'),
    place('clinic',['clinic','hospital'],'care','看護を手伝う'),
    place('armory',['smith','guardhome'],null,null),
    place('garden',['campfire'],'play','体を動かす'),
    find(['harbor'])?place('port',['harbor'],null,null):{id:'port',entityId:null,name:'東海岸の船着き場',x:166,z:0},
  ];
}
