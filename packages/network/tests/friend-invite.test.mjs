import test from 'node:test';
import assert from 'node:assert/strict';
import {createFriendVillageInvite,decodeFriendVillageInvite,friendVillageInviteFromLocation,friendVillageInviteUrl} from '../src/friend-invite.js';

test('friend village invite is explicit, fragment-only and round-trips',()=>{
 const now=1_700_000_000_000,invite=createFriendVillageInvite({offer:'webrtc-offer',villageId:'village-7',villageName:'友人の村',issuedAt:now});
 const url=new URL(friendVillageInviteUrl('https://example.test/friend.html',invite));
 assert.equal(url.search,'');
 assert.ok(url.hash.startsWith('#friend-village='));
 const decoded=friendVillageInviteFromLocation({hash:url.hash},{now:now+1000});
 assert.equal(decoded.villageId,'village-7');assert.equal(decoded.offer,'webrtc-offer');assert.equal(decoded.kind,'friend-village');
});

test('missing invitation stays hidden and expired invitation fails closed',()=>{
 assert.equal(friendVillageInviteFromLocation({hash:''}),null);
 const now=1_700_000_000_000,invite=createFriendVillageInvite({offer:'offer',villageId:'v',villageName:'村',issuedAt:now,ttl:60_000});
 assert.throws(()=>decodeFriendVillageInvite(encodeURIComponent(JSON.stringify(invite)),{now:now+60_001}),/期限切れ/);
});

test('malformed or oversized invitations are rejected',()=>{
 assert.throws(()=>decodeFriendVillageInvite('%7B%22kind%22%3A%22raid%22%7D'),/対応していない/);
 assert.throws(()=>createFriendVillageInvite({offer:'x'.repeat(40001),villageId:'v',villageName:'村'}),/offer is invalid/);
});
