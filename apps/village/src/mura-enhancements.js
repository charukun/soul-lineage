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
// MasterCharacter motion must install after the authoritative village is booted.
// Crowd spacing then wraps its final actor sync as presentation-only bias.
import './mura-master-characters.js';
import './mura-motion-crowd.js';

export const MURA_ENHANCEMENTS_READY = true;
