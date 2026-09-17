import {createSharedMotionRuntime} from '@soul/rendering/motion-runtime';

/**
 * Compatibility marker for the retired Shino-backed resident renderer.
 *
 * The module path remains present because Integration's exact-tree syntax
 * preflight validates removed JavaScript paths. It deliberately performs no
 * runtime installation and contains no model URL, loader, hash, or asset
 * reference. The authoritative procedural village resident presentation stays
 * active until a CC0 or RINNE-owned replacement is integrated.
 */
export const MASTER_RESIDENT_RENDERER_STATE = 'retired-conditional-model';
export const MASTER_RESIDENT_REPLACEMENT = 'procedural-resident-presentation';
export const MASTER_RESIDENT_MOTION_RUNTIME = createSharedMotionRuntime();
