// Load post-boot Village enhancements as one ordered module graph.
// Keep only modules that still own runtime side effects; retired compatibility shims are not graph nodes.
import './mura-world-systems.js';
import './mura-performance.js';
import './mura-experience.js';
import './mura-v2-ui.js';
import './mura-entry-polish.js';
import './mura-background-bgm.js';
import './mura-first-build.js';
import './mura-first-run-autoplay.js';
import './mura-director-polish.js';
import './mura-director-touch-fix.js';
import './mura-playability-polish.js';
import './mura-code-share.js';
import './village-kaykit-detail-unity.js';
// The legacy Shino MasterCharacter enhancement is intentionally not loaded.
// Conditional character-model assets are retired; the authoritative procedural
// resident presentation remains active until the CC0/RINNE replacement is ready.
import './mura-motion-crowd.js';

export const MURA_ENHANCEMENTS_READY = true;
