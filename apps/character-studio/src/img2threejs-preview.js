import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createImg2ThreeReferenceCharacter } from './img2threejs-bald-chibi.js';

const canvas = document.querySelector('#model');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor('#ffffff');
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight('#ffffff', '#aba9b2', 2.15));
const key = new THREE.DirectionalLight('#ffffff', 2.1);key.position.set(-3, 5, 7);scene.add(key);
const fill = new THREE.DirectionalLight('#dfedff', .75);fill.position.set(4, 3, -4);scene.add(fill);
const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
camera.position.set(0, 1.35, 4.9);
const controls = new OrbitControls(camera, canvas);controls.target.set(0, 1.35, 0);controls.enableDamping=true;
const model = await createImg2ThreeReferenceCharacter();scene.add(model);
window.img2threejsPreview = { ready: true, model, camera, renderer, setView };
document.querySelector('#status').textContent = 'img2threejs · 立体モデル';
function setView(name) {
  const angle = { front:0,right:Math.PI/2,back:Math.PI,left:-Math.PI/2,'three-quarter':Math.PI/4 }[name] ?? 0;
  camera.position.set(Math.sin(angle)*4.9,1.35,Math.cos(angle)*4.9);controls.update();
  model.rotation.y = 0;
}
let spinning=false;
for(const button of document.querySelectorAll('[data-view]')) button.addEventListener('click',()=>{spinning=false;setView(button.dataset.view)});
document.querySelector('#spin').addEventListener('click',()=>{spinning=!spinning;setView('front')});
function frame(){requestAnimationFrame(frame);const bounds=canvas.getBoundingClientRect();const w=Math.round(bounds.width),h=Math.round(bounds.height);if(canvas.width!==w||canvas.height!==h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}if(spinning)model.rotation.y+=.01;controls.update();renderer.render(scene,camera)}frame();
