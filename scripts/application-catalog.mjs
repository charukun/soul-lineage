import rinne from '../apps/rinne/package.json' with { type: 'json' };
import village from '../apps/village/package.json' with { type: 'json' };
import demon from '../apps/demon/package.json' with { type: 'json' };

// Package metadata is the current display-name authority, not an old build manifest.
export const GAME_NAMES = Object.freeze({ rinne: rinne.displayName, village: village.displayName, demon: demon.displayName });
export const GAME_ENVIRONMENTS = Object.freeze([
  { id: 'dev', label: '開発', branch: 'develop' },
  { id: 'staging', label: '検証', branch: 'develop' },
  { id: 'prod', label: '本番', branch: 'main' },
]);
export const BOARD_NAME = 'PULSE';
// Explicit initial scope approved by the environment-consistency request.
// New workspaces are NOT automatically authorized for a production launch.
export const INITIAL_ENVIRONMENT_APPS = Object.freeze(['rinne', 'village', 'demon']);
