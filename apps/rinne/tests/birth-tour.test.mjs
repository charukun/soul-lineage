import test from 'node:test';
import assert from 'node:assert/strict';
import {muraDialogueTopic} from '@soul/world/mura/dialogue';
import {BIRTH_TOUR_PACE,birthTourLine,birthTourPace,birthTourStops,createBirthTour} from '../src/rebuild/birth-tour.js';

const stations=[
  {id:'home',x:-4,z:-4,radius:2,label:'家',facilityKind:'home',topicId:'home-life'},
  {id:'garden',x:0,z:0,radius:3,label:'広場',facilityKind:'campfire',topicId:'village-square'},
  {id:'school',x:-5,z:2,radius:2,label:'学校',facilityKind:'school',topicId:'school-learning'},
  {id:'library',x:-3,z:5,radius:1,label:'本',facilityKind:'school',topicId:'books'},
  {id:'chapel',x:0,z:6,radius:2,label:'祈り',facilityKind:'chapel',topicId:'prayer'},
  {id:'dojo',x:3,z:5,radius:2,label:'道場',facilityKind:'dojo',topicId:'training'},
  {id:'smith',x:6,z:2,radius:2,label:'鍛冶',facilityKind:'smith',topicId:'smithing'},
  {id:'clinic',x:5,z:-3,radius:2,label:'診療所',facilityKind:'clinic',topicId:'healing'},
  {id:'port-prayer',x:166,z:0,radius:2,label:'港'},
  {id:'rack.weapon.sword',x:7,z:5,radius:1,label:'剣'},
];

test('birth tour uses village life facilities and skips port or equipment racks',()=>{
  assert.deepEqual(birthTourStops(stations).map(row=>row.id),['garden','home','school','library','chapel','dojo','smith','clinic']);
});

test('tour pace scales with village spread but passive travel stays within village guard pace',()=>{
  const compact=birthTourPace(stations),wide=birthTourPace(stations.map(row=>({...row,x:row.x*3,z:row.z*3})));
  assert.deepEqual(BIRTH_TOUR_PACE,{autoMin:3.6,autoMax:4.6,manualMin:4.25,manualMax:5.2,manualRatio:1.13});
  assert.equal(compact.autoSpeed,3.6);assert.equal(compact.manualSpeed,4.25);
  assert.equal(wide.autoSpeed,4.6);assert.equal(wide.manualSpeed,5.2);
  assert.ok(wide.autoSpeed>compact.autoSpeed);assert.ok(wide.manualSpeed>wide.autoSpeed);
});

test('facility narration is phrased from shared MURA dialogue facts',()=>{
  const square=muraDialogueTopic('village-square',{kind:'campfire'}),books=muraDialogueTopic('books',{kind:'school'});
  assert.match(birthTourLine(stations[1]),/広場/);assert.match(birthTourLine(stations[1]),new RegExp(square.fact));
  assert.match(birthTourLine(stations[3]),/本にはね/);assert.match(birthTourLine(stations[3]),new RegExp(books.fact));
  assert.equal(birthTourLine(stations[8]),null);assert.equal(birthTourLine(stations[9]),null);
  assert.equal(birthTourLine({id:'bad',topicId:'healing',facilityKind:'school'}),null);
});

test('manual movement pauses the mother tour and automatic travel resumes after input stops',()=>{
  const tour=createBirthTour(stations,{resumeDelay:1,dwellSeconds:.5});
  assert.equal(tour.tick(.1,{x:-7,z:-1},true).mode,'manual');
  assert.equal(tour.tick(.5,{x:-7,z:-1},false).mode,'paused');
  assert.equal(tour.tick(.5,{x:-7,z:-1},false).mode,'travel');
  assert.equal(tour.target().id,'garden');
});

test('arrival narrates a facility once then advances after a short dwell',()=>{
  const tour=createBirthTour(stations,{dwellSeconds:.25});
  let result=tour.tick(.1,{x:0,z:0},false);assert.equal(result.mode,'dwell');assert.match(result.line,/広場/);
  result=tour.tick(.25,{x:0,z:0},false);assert.equal(result.mode,'travel');assert.equal(tour.target().id,'home');
  assert.equal(tour.observe(stations[1]),null);
});
