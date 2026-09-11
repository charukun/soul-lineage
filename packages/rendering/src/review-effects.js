import { AdditiveBlending, NormalBlending, Sprite, SpriteMaterial, TextureLoader, SRGBColorSpace } from 'three';
/** Bounded, seekable texture-based preview. Does not manufacture a game hit event. */
export async function createReviewEffects(scene, baseUrl) {
  const loader = new TextureLoader(), textures = [], sprites = [];
  try {
    for (const name of ['flare_01.png','dirt_01.png','light_01.png']) {
      const texture = await loader.loadAsync(new URL(`particles/${name}`, baseUrl).href);
      texture.colorSpace = SRGBColorSpace; textures.push(texture);
    }
    for (let i = 0; i < 8; i++) {
      const material = new SpriteMaterial({map:textures[i === 0 ? 0 : i === 1 ? 2 : 1], transparent:true,
        depthWrite:false, blending:i < 2 ? AdditiveBlending : NormalBlending, color:i < 2 ? 0xffdbaa : 0xafa38f});
      const sprite = new Sprite(material); sprite.visible = false; scene.add(sprite); sprites.push(sprite);
    }
  } catch (error) { textures.forEach(t => t.dispose()); sprites.forEach(s => {s.removeFromParent();s.material.dispose();}); throw error; }
  return {
    sample(age, impact, ground) {
      const alive = Number.isFinite(age) && age >= 0 && age <= .38;
      sprites.forEach((sprite, i) => {
        sprite.visible = alive; if (!alive) return;
        const t = age / .38, a = (i - 2) * Math.PI / 3;
        if (i < 2) {
          sprite.position.copy(impact); sprite.material.opacity = (1 - t) ** 2;
          sprite.scale.set(i === 0 ? .2 + t * .7 : .055, i === 0 ? .2 + t * .7 : .6 + t * .9, 1);
          sprite.material.rotation = -.8;
        } else {
          sprite.position.copy(ground); sprite.position.x += Math.cos(a) * t * .4;
          sprite.position.z += Math.sin(a) * t * .4; sprite.position.y += .025 + Math.sin(t * Math.PI) * .12;
          sprite.material.opacity = (1 - t) * .35; sprite.scale.setScalar(.12 + t * .35); sprite.material.rotation = a;
        }
      });
    },
    dispose() { sprites.forEach(s => {s.removeFromParent();s.material.dispose();}); textures.forEach(t => t.dispose()); },
  };
}
