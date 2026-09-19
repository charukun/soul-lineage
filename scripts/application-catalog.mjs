import rinne from '../apps/rinne/package.json' with { type: 'json' };
import village from '../apps/village/package.json' with { type: 'json' };
import demon from '../apps/demon/package.json' with { type: 'json' };
import review from '../apps/review/package.json' with { type: 'json' };
import characterStudio from '../apps/character-studio/package.json' with { type: 'json' };
import eclipse from '../apps/eclipse/package.json' with { type: 'json' };

// Package metadata is the current display-name authority, not an old build manifest.
export const BOARD_NAME = 'PULSE';
export const GAME_NAMES = Object.freeze({ rinne: rinne.displayName, village: village.displayName, demon: demon.displayName });
export const DEV_APP_NAMES = Object.freeze({ ...GAME_NAMES, review: review.displayName, 'character-studio': characterStudio.displayName, eclipse: eclipse.displayName });
export const DEV_APPS = Object.freeze(Object.keys(DEV_APP_NAMES));
export const PULSE_SURFACES = Object.freeze([
  Object.freeze({ id:'rinne', deployApp:'rinne', kind:'game', displayName:rinne.displayName }),
  Object.freeze({ id:'village', deployApp:'village', kind:'game', displayName:village.displayName }),
  Object.freeze({ id:'demon', deployApp:'demon', kind:'game', displayName:demon.displayName }),
  Object.freeze({ id:'character-studio', deployApp:'character-studio', kind:'tool', displayName:characterStudio.displayName }),
  Object.freeze({ id:'visual-review', deployApp:'review', kind:'tool', displayName:review.displayName }),
  Object.freeze({ id:'eclipse', deployApp:'eclipse', kind:'reference', displayName:eclipse.displayName }),
  Object.freeze({ id:'ops-board', deployApp:'pulse', kind:'control', displayName:BOARD_NAME }),
  Object.freeze({ id:'portal', deployApp:null, kind:'external', displayName:'WAYFINDER' }),
]);
export const GAME_ENVIRONMENTS = Object.freeze([
  { id: 'dev', label: '開発', branch: 'develop' },
  { id: 'staging', label: '検証', branch: 'develop' },
  { id: 'prod', label: '本番', branch: 'main' },
]);
// Explicit initial scope approved by the environment-consistency request.
// New workspaces are NOT automatically authorized for a production launch.
export const INITIAL_ENVIRONMENT_APPS = Object.freeze(['rinne', 'village', 'demon']);
