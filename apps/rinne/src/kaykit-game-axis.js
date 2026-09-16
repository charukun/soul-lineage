export const KAYKIT_GAME_AXIS = Object.freeze({
  id: 'kaykit-first-v1',
  label: 'KayKit Game Axis',
  primaryRuntime: './lanternfell/index.html',
  primaryModel: 'knight',
  playableModels: Object.freeze(['knight', 'rogue', 'mage', 'barbarian']),
  comparisonModel: 'shino.reference.v2',
  source: Object.freeze({
    adventurers: Object.freeze({
      repository: 'KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0',
      commit: '672074b73ba276876a19e8816ecdc5241817ab47',
      license: 'CC0-1.0'
    })
  }),
  policy: Object.freeze({
    newGameplayFeaturesFollowKayKitRuntime: true,
    shinoIsCompatibilityReference: true,
    shinoIsRequiredForNewGameplay: false,
    preserveSaveAndGameplayAuthority: true
  })
});

export function primaryKayKitModel(){ return KAYKIT_GAME_AXIS.primaryModel; }
export function isKayKitPlayableModel(id){ return KAYKIT_GAME_AXIS.playableModels.includes(id); }
