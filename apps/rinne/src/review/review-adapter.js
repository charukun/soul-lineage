// Keep this file tiny. Astra can wire current game assets/VFX here without changing the review core.
// A preset may point to the exact GLB used by the game: { id, label, modelUrl }.
export const reviewPresets = Object.freeze([]);

export async function installReviewExtensions() {
  return {
    update() {},
    onMarker() {},
  };
}
