import { Box3, CanvasTexture, Color, Matrix4, Sprite, SpriteMaterial, Vector3 } from 'three';

const hull = points => {
  if (points.length <= 2) return points;
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of sorted) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  for (let i = sorted.length - 1; i >= 0; i--) { const p = sorted[i]; while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  lower.pop(); upper.pop(); return lower.concat(upper);
};

function sourcePoints(root, maxVertices) {
  root.updateWorldMatrix?.(true, true);
  const inverse = new Matrix4().copy(root.matrixWorld).invert(), point = new Vector3(), rows = [], renderables = [];
  const colors = [];
  root.traverse?.(node => {
    if (!node?.isMesh || node.isSkinnedMesh || node.morphTargetInfluences || !node.geometry?.attributes?.position) return;
    renderables.push(node);
    const materials = (Array.isArray(node.material) ? node.material : [node.material]).filter(Boolean);
    for (const material of materials) if (material.color) colors.push(material.color);
    const position = node.geometry.attributes.position, remaining = Math.max(1, maxVertices - rows.length);
    const step = Math.max(1, Math.ceil(position.count / remaining));
    for (let i = 0; i < position.count && rows.length < maxVertices; i += step) {
      point.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld).applyMatrix4(inverse);
      if ([point.x, point.y, point.z].every(Number.isFinite)) rows.push([point.x, point.y, point.z]);
    }
  });
  const color = new Color(.6, .6, .6);
  if (colors.length) {
    color.setRGB(0, 0, 0);
    for (const value of colors) { color.r += value.r; color.g += value.g; color.b += value.b; }
    color.multiplyScalar(1 / colors.length);
  }
  return { rows, renderables, color };
}

function drawAtlas(points, color, { views, size, canvasFactory }) {
  const canvas = canvasFactory();
  canvas.width = size * views; canvas.height = size;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) throw new Error('Impostor canvas 2D context unavailable');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = `#${color.getHexString()}`;
  for (let view = 0; view < views; view++) {
    const angle = view / views * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
    const projected = points.map(([x, y, z]) => [x * c - z * s, y]);
    const shape = hull(projected); if (shape.length < 3) continue;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of shape) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const width = Math.max(1e-6, maxX - minX), height = Math.max(1e-6, maxY - minY), margin = size * .08;
    const scale = Math.min((size - margin * 2) / width, (size - margin * 2) / height);
    const ox = view * size + (size - width * scale) / 2, oy = (size - height * scale) / 2;
    ctx.beginPath();
    shape.forEach(([x, y], index) => {
      const px = ox + (x - minX) * scale, py = size - (oy + (y - minY) * scale);
      if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath(); ctx.fill();
  }
  return canvas;
}

/** Deterministic geometry-derived 8-view far silhouette card for static groups. */
export function installSilhouetteImpostorLOD(root, { distance = 110, views = 8, size = 96, maxVertices = 6000, canvasFactory = () => document.createElement('canvas') } = {}) {
  if (!root?.traverse || root.isMesh || !(distance > 0) || !Number.isInteger(views) || views < 4) return null;
  if (root.userData?.streamingCritical || root.userData?.interactive || root.userData?.impostorDisabled) return null;
  const { rows, renderables, color } = sourcePoints(root, maxVertices);
  if (rows.length < 16 || !renderables.length) return null;
  const bounds = new Box3();
  for (const [x, y, z] of rows) bounds.expandByPoint(new Vector3(x, y, z));
  const extent = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
  if (!(extent.y > .05) || Math.max(extent.x, extent.z) > 180) return null;
  const canvas = drawAtlas(rows, color, { views, size, canvasFactory });
  const texture = new CanvasTexture(canvas); texture.repeat.set(1 / views, 1); texture.needsUpdate = true;
  texture.userData = { ...(texture.userData || {}), soulLifetimeOwned: true, soulImpostorAtlas: true };
  const material = new SpriteMaterial({ map: texture, transparent: true, alphaTest: .02, depthWrite: true });
  material.userData = { ...(material.userData || {}), soulLifetimeOwned: true };
  const sprite = new Sprite(material); sprite.visible = false; sprite.position.copy(center);
  sprite.scale.set(Math.max(extent.x, extent.z) * 1.08, extent.y * 1.08, 1); sprite.userData.soulImpostor = true;
  root.add(sprite);
  const rootWorld = new Vector3(), cameraWorld = new Vector3(); let far = false, switches = 0, sourceState = new Map();
  return {
    root, sprite, distance, views,
    update(camera) {
      if (!camera?.getWorldPosition) return { far, distance: null, switches };
      const currentDistance = root.getWorldPosition(rootWorld).distanceTo(camera.getWorldPosition(cameraWorld));
      const nextFar = currentDistance >= distance;
      if (nextFar !== far) {
        if (nextFar) {
          sourceState = new Map(renderables.map(node => [node, node.visible]));
          for (const node of renderables) node.visible = false;
          sprite.visible = true;
        } else {
          for (const node of renderables) node.visible = sourceState.get(node) ?? true;
          sprite.visible = false;
          sourceState.clear();
        }
        far = nextFar; switches++;
      }
      if (far) {
        const dx = cameraWorld.x - rootWorld.x, dz = cameraWorld.z - rootWorld.z;
        const angle = (Math.atan2(dx, dz) + Math.PI * 2) % (Math.PI * 2);
        const index = Math.round(angle / (Math.PI * 2) * views) % views;
        texture.offset.x = index / views; texture.needsUpdate = true;
      }
      return { far, distance: currentDistance, switches };
    },
    snapshot() { return Object.freeze({ far, distance, views, switches, vertices: rows.length, size: [extent.x, extent.y, extent.z] }); },
    dispose() {
      if (far) for (const node of renderables) node.visible = sourceState.get(node) ?? true;
      root.remove(sprite); material.dispose(); texture.dispose(); sourceState.clear();
    },
  };
}
