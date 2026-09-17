// Originals are never edited. Presentation scale/timing live in combat-effect-cues.js.
export const EFFECT_SOURCE = Object.freeze({
  repository: 'effekseer/ResourceData',
  revision: '1adef35d78363d3e914192267adf83a8e2b30759',
  license: 'CC0-1.0',
  licenseRepository: 'effekseer/Effekseer',
  licenseRevision: '216c307192ff9bc7917472b05731bbc4fd46fa04',
  licensePath: 'docs/readme_sample.txt',
  licenseBlob: 'dd2fdb3f8a615965bf54be715a6c0ccbca5daae3',
});
export const EFFECT_RUNTIME = Object.freeze({
  repository: 'effekseer/EffekseerForWebGL',
  revision: 'e8c3ce076644789918695b0cba0031461c817890',
  version: '1.70',
  license: 'MIT',
});
export const EFFECT_PUBLIC_PATH = 'simulator/assets/effekseer/';
const asset = (path, byteLength, gitBlobSha) => Object.freeze({path, byteLength, gitBlobSha});
export const EFFECT_ASSETS = Object.freeze([
  asset('samples/00_Basic/Simple_Ribbon_Sword.efkefc', 1460, 'ed915a21497404acb35ae3e8fd92f50f60b192d1'),
  asset('samples/00_Basic/Texture/SwordLine01.png', 6493, '3b61f140cee86c35cf9e028d42cd3097cb06f2be'),
  asset('samples/02_Tktk03/ToonHit.efkefc', 10131, '6f676ce9103841abb854f46e01033f97c6627c6d'),
  asset('samples/02_Tktk03/Light.efkefc', 29679, 'd3057b829b56b2deac38b58d62f0c83f365a26b1'),
  asset('samples/02_Tktk03/Parts/Aura.png', 92262, '65385068ec4e16981902d8ab5ce23cc1f0c6a21c'),
  asset('samples/02_Tktk03/Parts/AuraTube.efkmat', 10619, '9601511a558a98bce619dd79098c424691529c60'),
  asset('samples/02_Tktk03/Parts/AuraTubeModel.efkmodel', 119136, '35a8ab1a7de419a5054e8d2b7695e53f23916e37'),
  asset('samples/02_Tktk03/Parts/ColorNoise.png', 330737, '0e61944149fa896dc642f9f60a71fe86a4b356a3'),
  asset('samples/02_Tktk03/Parts/Gradient_2.png', 1106, '34a5f6808b684b1499b0f8eccc7a65ec4e0395f3'),
  asset('samples/02_Tktk03/Parts/Gradient__1.png', 1171, '5216303d74e345ab15a28b84243dc100105a4852'),
  asset('samples/02_Tktk03/Parts/Gradient__3.png', 1134, 'ea2f61eaf19740579e4df2c0d7e823d0542dbcc5'),
  asset('samples/02_Tktk03/Parts/Noise2.png', 11166, 'a098856a74bd9c590a775cd365681df929074492'),
  asset('samples/02_Tktk03/Parts/Null.png', 1042, '57f6867c3f3961c3ab58a415e9f1419c3f4d8ddc'),
  asset('samples/02_Tktk03/Parts/Particle1.png', 2608, '5bf4b4dd8ad2987a819a96e1e75fc5f1f6153c59'),
  asset('samples/02_Tktk03/Parts/ParticleCore.png', 2539, 'c48d6ab73f5d43fcb850892c755b00eb13eddaf0'),
  asset('samples/02_Tktk03/Parts/RadiarNoise.efkmat', 15803, 'a4ec87edb89dd431e9059457f7a8e4643783663e'),
  asset('samples/02_Tktk03/Parts/Ring.png', 23328, '832c328eeb5c7b33e765cb44600abc69a9fa4911'),
  asset('samples/02_Tktk03/Parts/Ring2.png', 10573, 'a222c178042cc080019ee785b9315f8fd7139a40'),
  asset('samples/02_Tktk03/Parts/Round.efkmodel', 266136, 'b562ae5d09da1ee8fb12c1b62566666ede3de9f0'),
  asset('samples/02_Tktk03/Parts/ToonBase.efkmat', 14791, '1b6c1849725cd3f55e2147890c17fffeb25b77c7'),
  asset('samples/02_Tktk03/Parts/ToonImpact.efkmat', 15538, '7fd609a5e201e8069adf9cfef1b0f5a98cebe402'),
]);
export const RUNTIME_ASSETS = Object.freeze([
  asset('docs/effekseer.js', 216603, '9d90abff9ec9e24812aea2ce07d93c8798a10920'),
  asset('docs/effekseer.wasm', 1201973, 'c4c0e39ad688caec1401f2c408f88b3a387ea9a1'),
  asset('LICENSE', 1084, 'c7c0094a9a163d8013086a42b3dcb3a46f984cb1'),
]);
export const AUTHORED_EFFECTS = Object.freeze({
  slash: Object.freeze({path:EFFECT_ASSETS[0].path, author:'Effekseer', scale:.32, lifetime:.65}),
  impact: Object.freeze({path:EFFECT_ASSETS[2].path, author:'tktk', scale:.065, lifetime:1.2}),
  finisher: Object.freeze({path:EFFECT_ASSETS[3].path, author:'tktk', scale:.05, lifetime:1.8}),
});
