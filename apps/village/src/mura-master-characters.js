import {createSharedMotionRuntime} from '@soul/rendering/motion-runtime';

/**
 * Compatibility marker retained for integrations that inspect the old resident
 * renderer module. Human residents now resolve through the shared KayKit
 * foundation in character-runtime-integration.js; procedural people are only a
 * load-failure fallback and are not the normal presentation contract.
 */
export const MASTER_RESIDENT_RENDERER_STATE = 'shared-kaykit-runtime';
export const MASTER_RESIDENT_REPLACEMENT = 'kaykit.adventurers.v1';
export const MASTER_RESIDENT_MOTION_RUNTIME = createSharedMotionRuntime();
