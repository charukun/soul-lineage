// Single edit point for swapping the 百年転生 title movie.
// Replace the movie/poster under public/title-assets, then update this manifest only.
// Keep the introEnd frame visually identical to the first Living Still frame so the title lands without a cut.
export const TITLE_CINEMATIC_MANIFEST=Object.freeze({
  revision:'2026-09-20-legacy-960-v1',
  video:'./title-assets/title-cinematic.mp4',
  poster:'./title-assets/title-cinematic-poster.webp',
  introEnd:8.45,
  duration:13.5,
  livingDuration:5.05,
  firstViewSkipAfter:1.5,
  repeatViewSkipAfter:0,
  width:960,
  height:540,
  fps:18,
  recommendedWidth:1920,
  recommendedHeight:1080,
  recommendedFps:24,
});
