export const FRIEND_VILLAGE_INVITE_VERSION=1;
export const FRIEND_VILLAGE_INVITE_HASH='friend-village';
export const FRIEND_VILLAGE_INVITE_TTL=15*60*1000;

function assertText(value,label,max){if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`${label} is invalid`);return value.trim();}
export function createFriendVillageInvite({offer,villageId,villageName,issuedAt=Date.now(),ttl=FRIEND_VILLAGE_INVITE_TTL}={}){
 assertText(offer,'offer',40000);assertText(villageId,'villageId',180);assertText(villageName,'villageName',80);
 if(!Number.isFinite(issuedAt)||!Number.isFinite(ttl)||ttl<60_000||ttl>FRIEND_VILLAGE_INVITE_TTL)throw new Error('invite lifetime is invalid');
 return{version:FRIEND_VILLAGE_INVITE_VERSION,kind:'friend-village',offer,villageId,villageName,issuedAt,expiresAt:issuedAt+ttl};
}
export function encodeFriendVillageInvite(invite){return encodeURIComponent(JSON.stringify(invite));}
export function assertFriendVillageInviteActive(invite,{now=Date.now()}={}){
 if(invite?.version!==FRIEND_VILLAGE_INVITE_VERSION||invite?.kind!=='friend-village')throw new Error('対応していない友人招待です。');
 assertText(invite.offer,'offer',40000);assertText(invite.villageId,'villageId',180);assertText(invite.villageName,'villageName',80);
 if(!Number.isFinite(now)||!Number.isFinite(invite.issuedAt)||!Number.isFinite(invite.expiresAt)||invite.expiresAt<=invite.issuedAt||invite.expiresAt-invite.issuedAt>FRIEND_VILLAGE_INVITE_TTL)throw new Error('友人招待の有効期限が不正です。');
 if(now>=invite.expiresAt)throw new Error('この友人招待は期限切れです。もう一度招待してもらってください。');
 return invite;
}
export function decodeFriendVillageInvite(value,{now=Date.now()}={}){
 let invite;try{invite=JSON.parse(decodeURIComponent(String(value||'')));}catch{throw new Error('友人招待を読み取れません。');}
 return assertFriendVillageInviteActive(invite,{now});
}
export function friendVillageInviteUrl(base,invite){const url=new URL(base);url.hash='';const params=new URLSearchParams();params.set(FRIEND_VILLAGE_INVITE_HASH,encodeFriendVillageInvite(invite));url.hash=params.toString();return url.href;}
export function friendVillageInviteFromLocation(locationLike,{now=Date.now()}={}){const hash=String(locationLike?.hash||'').replace(/^#/,'');const value=new URLSearchParams(hash).get(FRIEND_VILLAGE_INVITE_HASH);return value?decodeFriendVillageInvite(value,{now}):null;}
