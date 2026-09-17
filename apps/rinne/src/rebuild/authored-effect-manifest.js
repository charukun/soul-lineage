// Originals are never edited. Presentation scale/timing live in combat-effect-cues.js and review-effects-catalog.js.
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
const asset = (path, byteLength, gitBlobSha, metadata={}) => Object.freeze({path, byteLength, gitBlobSha, ...metadata});

const SOURCE_PATHS=Object.freeze({
  slash:'samples/00_Basic/Simple_Ribbon_Sword.efkefc',
  impact:'samples/02_Tktk03/ToonHit.efkefc',
  finisher:'samples/02_Tktk03/Light.efkefc',
  laser01:'samples/00_Basic/Laser01.efkefc',
  laser02:'samples/00_Basic/Laser02.efkefc',
  laser03:'samples/00_Basic/Laser03.efkefc',
  fireworks:'samples/00_Basic/Simple_Turbulence_Fireworks.efkefc',
  toonWater:'samples/02_Tktk03/ToonWater.efkefc',
});

export const EFFECT_ASSETS = Object.freeze([
  asset(SOURCE_PATHS.slash, 1460, 'ed915a21497404acb35ae3e8fd92f50f60b192d1', {infoVersion:1500}),
  asset('samples/00_Basic/Texture/SwordLine01.png', 6493, '3b61f140cee86c35cf9e028d42cd3097cb06f2be'),
  asset(SOURCE_PATHS.impact, 10131, '6f676ce9103841abb854f46e01033f97c6627c6d', {infoVersion:1500}),
  asset(SOURCE_PATHS.finisher, 29679, 'd3057b829b56b2deac38b58d62f0c83f365a26b1', {infoVersion:1610}),
  asset(SOURCE_PATHS.laser01, 4365, 'a97c4a678fee205590415282b98fc580dc4ff441', {infoVersion:1500}),
  asset(SOURCE_PATHS.laser02, 9000, '98c362e209437ec4ce2814056b450616d05a5a5f', {infoVersion:1500}),
  asset(SOURCE_PATHS.laser03, 5451, '12a7e156c135207ba87687dd735db6c3cab2f156', {infoVersion:1500}),
  asset(SOURCE_PATHS.fireworks, 4036, '0c2dcb26c6e1889d54c7930bee89bb7c4fd3b723', {infoVersion:1500}),
  asset('samples/00_Basic/Texture/Burst01.png', 35183, '0b71deed2830824297e7ff74c44153df4658e5e4'),
  asset('samples/00_Basic/Texture/LaserMain01.png', 5479, '34d9b42afba1e999cab277c3d80ef3d3223e2608'),
  asset('samples/00_Basic/Texture/LaserMain02.png', 2192, '7d917b5438626411639142ba4041295353c0f278'),
  asset('samples/00_Basic/Texture/Particle01.png', 7082, 'ce5ae5e9d0c3561f47e419b9f2b5fa5e1676f344'),
  asset('samples/00_Basic/Texture/Particle02.png', 7230, '88b7fb3396201caacc73312e1241c8edd8f92881'),
  asset('samples/00_Basic/Texture/Thunder01.png', 19998, '2cdbc272dedccaf47aa3ceeca6dcfb2df933e508'),
  asset(SOURCE_PATHS.toonWater, 49242, 'b626f6b6d5d3c80224b34c9404bb55c1073d5789', {infoVersion:1610}),
  asset('samples/02_Tktk03/Parts/Aura.png', 92262, '65385068ec4e16981902d8ab5ce23cc1f0c6a21c'),
  asset('samples/02_Tktk03/Parts/AuraTube.efkmat', 10619, '9601511a558a98bce619dd79098c424691529c60'),
  asset('samples/02_Tktk03/Parts/AuraTubeModel.efkmodel', 119136, '35a8ab1a7de419a5054e8d2b7695e53f23916e37'),
  asset('samples/02_Tktk03/Parts/Aura_2.png', 36139, '201a6d939c3880d0c6c162c9f5f6fc2925744c86'),
  asset('samples/02_Tktk03/Parts/ColorNoise.png', 330737, '0e61944149fa896dc642f9f60a71fe86a4b356a3'),
  asset('samples/02_Tktk03/Parts/Gradient_2.png', 1106, '34a5f6808b684b1499b0f8eccc7a65ec4e0395f3'),
  asset('samples/02_Tktk03/Parts/Gradient__1.png', 1171, '5216303d74e345ab15a28b84243dc100105a4852'),
  asset('samples/02_Tktk03/Parts/Gradient__3.png', 1134, 'ea2f61eaf19740579e4df2c0d7e823d0542dbcc5'),
  asset('samples/02_Tktk03/Parts/Impact.efkmodel', 46104, 'f9c8da25ab58669a3cbc1208d4b2c79a588b950e'),
  asset('samples/02_Tktk03/Parts/Noise2.png', 11166, 'a098856a74bd9c590a775cd365681df929074492'),
  asset('samples/02_Tktk03/Parts/Noise3.png', 14091, 'bfce990b406dcc7da612425ee72acd75cc014c6c'),
  asset('samples/02_Tktk03/Parts/Noise4.png', 108795, '78b71aa214b8ef2c4d7d85dff2c0da88f9b1e5f0'),
  asset('samples/02_Tktk03/Parts/Null.png', 1042, '57f6867c3f3961c3ab58a415e9f1419c3f4d8ddc'),
  asset('samples/02_Tktk03/Parts/Particle1.png', 2608, '5bf4b4dd8ad2987a819a96e1e75fc5f1f6153c59'),
  asset('samples/02_Tktk03/Parts/ParticleCore.png', 2539, 'c48d6ab73f5d43fcb850892c755b00eb13eddaf0'),
  asset('samples/02_Tktk03/Parts/RadiarNoise.efkmat', 15803, 'a4ec87edb89dd431e9059457f7a8e4643783663e'),
  asset('samples/02_Tktk03/Parts/Ring.png', 23328, '832c328eeb5c7b33e765cb44600abc69a9fa4911'),
  asset('samples/02_Tktk03/Parts/Ring2.png', 10573, 'a222c178042cc080019ee785b9315f8fd7139a40'),
  asset('samples/02_Tktk03/Parts/Round.efkmodel', 266136, 'b562ae5d09da1ee8fb12c1b62566666ede3de9f0'),
  asset('samples/02_Tktk03/Parts/ToonBase.efkmat', 14791, '1b6c1849725cd3f55e2147890c17fffeb25b77c7'),
  asset('samples/02_Tktk03/Parts/ToonImpact.efkmat', 15538, '7fd609a5e201e8069adf9cfef1b0f5a98cebe402'),
  asset('samples/02_Tktk03/Parts/ToonWaterTube.efkmat', 15489, '7766aa3b76a76e22387b737879db8c81daac678d'),
]);
export const RUNTIME_ASSETS = Object.freeze([
  asset('docs/effekseer.js', 216603, '9d90abff9ec9e24812aea2ce07d93c8798a10920'),
  asset('docs/effekseer.wasm', 1201973, 'c4c0e39ad688caec1401f2c408f88b3a387ea9a1'),
  asset('LICENSE', 1084, 'c7c0094a9a163d8013086a42b3dcb3a46f984cb1'),
]);
const definition=(path,author,scale,lifetime)=>Object.freeze({path,author,scale,lifetime});
export const AUTHORED_EFFECTS = Object.freeze({
  slash: definition(SOURCE_PATHS.slash,'Effekseer',.32,.65),
  impact: definition(SOURCE_PATHS.impact,'tktk',.065,1.2),
  finisher: definition(SOURCE_PATHS.finisher,'tktk',.05,1.8),
});
export const REVIEW_AUTHORED_EFFECTS = Object.freeze({
  ...AUTHORED_EFFECTS,
  laser01: definition(SOURCE_PATHS.laser01,'Effekseer',.18,1.35),
  laser02: definition(SOURCE_PATHS.laser02,'Effekseer',.18,1.55),
  laser03: definition(SOURCE_PATHS.laser03,'Effekseer',.2,1.1),
  fireworks: definition(SOURCE_PATHS.fireworks,'Effekseer',.18,1.7),
  toonWater: definition(SOURCE_PATHS.toonWater,'tktk',.055,1.8),
});
