// Load post-boot village enhancements as one ordered module graph.
// Side-effect import order intentionally matches the historical bootstrap order.
import './mura-world-systems.js';
import './mura-performance.js';
import './mura-experience.js';
import './mura-rotation-fix.js';
import './mura-v2-ui.js';
import './mura-entry-polish.js';
import './mura-housing-ui-polish.js';
import './mura-mobile-feedback-fix.js';
import './mura-mobile-feedback-fix-2.js';
import './mura-mobile-feedback-fix-3.js';
import './mura-ux-polish-4.js';
import './mura-ux-polish-4b.js';
import './mura-background-bgm.js';
import './mura-first-build.js';
import './mura-director-polish.js';

export const MURA_ENHANCEMENTS_READY = true;
