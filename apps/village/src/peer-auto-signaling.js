import {assertFriendVillageInviteActive} from '@soul/network/friend-invite';
import {createPeerSignalingClient, sampleBrowserHostCapability} from '@soul/platform-web/peer-signaling';
import {normalizeHostCapability} from '@soul/network';

function signalingDetails(invite) {
  assertFriendVillageInviteActive(invite);
  const signal = invite.signaling;
  if (signal?.version !== 1 || !/^[a-f0-9]{14}$/.test(signal.roomId) || !/^[a-f0-9]{64}$/.test(signal.inviteToken)) {
    throw new Error('自動接続の招待情報が不正です。手動の参加返事を利用してください。');
  }
  return signal;
}

// The owner creates a room only after explicitly creating a friend invitation.
// The optional descriptor leaves the existing SDP/manual-answer route usable.
export async function createFriendAutoSignaling({invite, acceptAnswer, snapshot = () => null, onStatus = () => {}, client = createPeerSignalingClient(), sample = sampleBrowserHostCapability, schedule = setInterval, cancel = clearInterval} = {}) {
  assertFriendVillageInviteActive(invite);
  const created = await client.createRoom({worldId: invite.villageId, label: invite.villageName, hostId: crypto.randomUUID(), purpose: 'visitor', capability: normalizeHostCapability(await sample())});
  const signal = {version: 1, roomId: created.room.roomId, inviteToken: created.inviteToken};
  const linkedInvite = {...invite, signaling: signal};
  signalingDetails(linkedInvite);
  let cursor = 0, stopped = false, accepted = false, busy = false, timer;
  const offered = new Set();
  async function close() {
    if (stopped) return;
    stopped = true;
    cancel(timer);
    await client.closeRoom(signal.roomId, created.hostToken).catch(() => {});
  }
  async function tick() {
    if (stopped || busy) return;
    busy = true;
    try {
      assertFriendVillageInviteActive(linkedInvite);
      if (!accepted) {
        const data = await client.pollHost(signal.roomId, created.hostToken, cursor);
        if (stopped) return;
        assertFriendVillageInviteActive(linkedInvite);
        cursor = data.next ?? cursor;
        for (const event of data.events || []) {
          if (event.type === 'join' && event.hostEligible === false && !offered.size) {
            await client.postOffer(signal.roomId, event.joinId, created.hostToken, invite.offer);
            offered.add(event.joinId);
          } else if (event.type === 'answer' && offered.has(event.joinId) && !accepted) {
            await acceptAnswer(event.answer);
            accepted = true;
            onStatus('友人の参加返事を自動で受け取りました。');
          }
        }
      }
      const state = snapshot();
      if (state) await client.telemetry(signal.roomId, created.hostToken, {phase: state.phase, peers: Object.keys(state.authority?.members || {}).length || 1, epoch: state.epoch, checkpointRevision: 0});
    } catch (error) {
      onStatus(`自動接続を終了しました。参加返事を手動で受け取れます: ${error.message}`);
      await close();
    } finally { busy = false; }
  }
  timer = schedule(() => { void tick(); }, 700);
  return {invite: linkedInvite, tick, close};
}

export async function sendFriendAutoAnswer(invite, answer, {client = createPeerSignalingClient(), pause = ms => new Promise(resolve => setTimeout(resolve, ms))} = {}) {
  const signal = signalingDetails(invite);
  const joined = await client.joinRoom(signal.roomId, {inviteToken: signal.inviteToken, peerId: crypto.randomUUID(), app: 'village', hostEligible: false});
  let cursor = 0;
  for (let attempt = 0; attempt < 40; attempt++) {
    assertFriendVillageInviteActive(invite);
    const data = await client.pollGuest(signal.roomId, joined.joinId, joined.guestToken, cursor);
    cursor = data.next ?? cursor;
    const offer = data.events?.find(event => event.type === 'offer');
    if (offer) {
      if (offer.offer !== invite.offer) throw new Error('招待と異なる接続情報を受信しました。');
      assertFriendVillageInviteActive(invite);
      await client.postAnswer(signal.roomId, joined.joinId, joined.guestToken, answer);
      return true;
    }
    await pause(250);
  }
  throw new Error('自動接続が時間切れになりました。参加返事を友人へ送ってください。');
}
