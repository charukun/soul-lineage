import { Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import './style.css';

// Initial milestone: an intentionally blank, white WebGL scene.
const canvas = document.querySelector('#game');
document.title = `魂の系譜 | ${__BUILD_INFO__.environment.toUpperCase()}`;
canvas.dataset.environment = __BUILD_INFO__.environment;
canvas.dataset.commit = __BUILD_INFO__.commit;

const scene = new Scene();
scene.background = new Color(0xffffff);
const camera = new PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.z = 5;

let renderer;
try {
  renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  const resize = () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    canvas.dataset.renderer = 'ready';
  };
  resize();
  window.addEventListener('resize', resize);
  canvas.addEventListener('webglcontextlost', () => { canvas.dataset.renderer = 'context-lost'; });
  canvas.addEventListener('webglcontextrestored', resize);
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener('resize', resize);
      renderer.dispose();
    });
  }
} catch (error) {
  canvas.dataset.renderer = 'unavailable';
  console.error('WebGL2 initialization failed.', error);
}
