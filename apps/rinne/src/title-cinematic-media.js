import { TITLE_CINEMATIC_MANIFEST } from './title-cinematic-manifest.js';

const revision=encodeURIComponent(TITLE_CINEMATIC_MANIFEST.revision);
export const TITLE_CINEMATIC_META=Object.freeze({
  introEnd:TITLE_CINEMATIC_MANIFEST.introEnd,
  duration:TITLE_CINEMATIC_MANIFEST.duration,
  livingDuration:TITLE_CINEMATIC_MANIFEST.livingDuration,
  firstViewSkipAfter:TITLE_CINEMATIC_MANIFEST.firstViewSkipAfter,
  repeatViewSkipAfter:TITLE_CINEMATIC_MANIFEST.repeatViewSkipAfter,
  width:TITLE_CINEMATIC_MANIFEST.width,
  height:TITLE_CINEMATIC_MANIFEST.height,
  fps:TITLE_CINEMATIC_MANIFEST.fps,
  quality:TITLE_CINEMATIC_MANIFEST.width>=1600&&TITLE_CINEMATIC_MANIFEST.height>=900?'hd':'legacy',
});
export const TITLE_VIDEO_URL=`${TITLE_CINEMATIC_MANIFEST.video}?v=${revision}`;
export const TITLE_POSTER_URL=`${TITLE_CINEMATIC_MANIFEST.poster}?v=${revision}`;
