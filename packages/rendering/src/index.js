import { Scene, Color, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight, Mesh, BoxGeometry, PlaneGeometry, MeshStandardMaterial, SRGBColorSpace } from 'three';
import { assetById } from '@soul/assets';
// WebGL presentation adapter. Receives portable world data, contains no game rules.
export function createWorldPreview(canvas, world) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = SRGBColorSpace;
  const scene = new Scene(); scene.background = new Color('#e9eee5');
  const camera = new PerspectiveCamera(34, 1, 0.1, 100); camera.position.set(4, 3.4, 5); camera.lookAt(0, 0.3, 0);
  scene.add(new HemisphereLight('#fff8e6', '#859d83', 2.6));
  const light = new DirectionalLight('#fff0d1', 3); light.position.set(3, 5, 2); scene.add(light);
  const resources = [];
  function box(size, position, color) {
    const geometry = new BoxGeometry(...size); const material = new MeshStandardMaterial({ color, roughness: 0.85 });
    resources.push(geometry, material); const mesh = new Mesh(geometry, material); mesh.position.set(...position); scene.add(mesh);
  }
  for (const entity of world.entities) {
    const asset = assetById(entity.assetId);
    if (asset.id === 'furniture.bench.oak.v1') {
      const [x, y, z] = entity.position;
      box([2.2, .13, .7], [x, y + .5, z], asset.color);
      box([2.2, .47, .11], [x, y + .85, z - .28], asset.color);
      for (const side of [-.85, .85]) for (const depth of [-.23, .23]) box([.12, .5, .12], [x + side, y + .25, z + depth], '#614b37');
    }
  }
  const groundGeometry = new PlaneGeometry(200, 200); const groundMaterial = new MeshStandardMaterial({ color: '#e0e8d8', roughness: 1 });
  const ground = new Mesh(groundGeometry, groundMaterial); ground.rotation.x = -Math.PI / 2; ground.position.y = -.02; scene.add(ground); resources.push(groundGeometry, groundMaterial);
  function render() {
    const width = Math.max(canvas.clientWidth, 1), height = Math.max(canvas.clientHeight, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.render(scene, camera);
    canvas.dataset.renderer = 'ready'; canvas.dataset.world = world.id; canvas.dataset.asset = world.entities[0].assetId;
  }
  const observer = new ResizeObserver(render); observer.observe(canvas);
  const lost = event => { event.preventDefault(); canvas.dataset.renderer = 'context-lost'; };
  canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', render); render();
  return { dispose() { observer.disconnect(); canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', render); resources.forEach(r => r.dispose()); renderer.dispose(); } };
}
// App render adapters reuse the workspace engine; never ship a second vendor copy.
export * as THREE from 'three';
export { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
