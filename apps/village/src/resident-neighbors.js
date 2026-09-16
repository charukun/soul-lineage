import {createSpatialIndex} from '@soul/world/spatial-index';

/** Presentation-only neighborhood, rebuilt once per visual frame. */
export function createResidentNeighborhood(radius=.82){
 const index=createSpatialIndex({cellSize:radius*2}),rows=[],neighbors=[];
 let lastTime=null,lastPeople=null,lastRevision=null,builds=0,candidates=0;
 return {
  query(person,people,time,revision=0){
   if(time!==lastTime||people!==lastPeople||revision!==lastRevision){
    index.beginFrame();
    for(const other of people)if(!other.hidden&&!other.downed&&Number.isFinite(other.x)&&Number.isFinite(other.z))index.upsert(other.id,other.x,other.z,{data:other});
    index.endFrame();lastTime=time;lastPeople=people;lastRevision=revision;builds++;
   }
   index.queryRadiusInto(rows,person.x,person.z,radius);
   neighbors.length=0;
   for(const row of rows)if(row.data!==person){neighbors.push(row.data);candidates++;}
   return neighbors;
  },
  snapshot(){return {builds,candidates,...index.snapshot()};},
 };
}
