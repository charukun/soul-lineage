import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const host=readFileSync(new URL('../src/online.js',import.meta.url),'utf8');
const guest=readFileSync(new URL('../src/friend-visit.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../friend.html',import.meta.url),'utf8');
const vite=readFileSync(new URL('../vite.config.js',import.meta.url),'utf8');

test('friend visit stays invite-only and outside raid authority',()=>{
 assert.match(host,/友人を村へ招待/);assert.match(host,/m\.role!==['"]visitor['"]/);
 assert.doesNotMatch(host,/RaidHost/);assert.doesNotMatch(host,/role:\s*['"]demon['"]/);
 assert.match(guest,/role:['"]visitor['"]/);assert.match(guest,/friendVillageInviteFromLocation/);
 assert.doesNotMatch(guest,/localStorage\.setItem/);assert.doesNotMatch(guest,/ProfileStore|RaidSession/);
});

test('friend visit shares appearance only and carries no raid rewards',()=>{
 assert.match(host,/visualSnapshot/);assert.match(host,/room:\[\]/);assert.doesNotMatch(host,/news:/);assert.doesNotMatch(host,/ledger/);
 assert.match(html,/見学専用/);assert.match(html,/襲撃・捕食・報酬・入村履歴には影響しません/);
 assert.match(html,/noindex,nofollow/);
});

test('friend page is part of the village build',()=>{
 assert.match(vite,/friend\.html/);assert.match(vite,/input:\{main:/);
});
