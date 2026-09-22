/** One bounded draw call, no asset requests and no per-step GPU allocation. */
export function createGroundDust({ THREE: T, scene, camera, canvas }) {
  const CAPACITY = 64;
  const position = new Float32Array(CAPACITY * 3), color = new Float32Array(CAPACITY * 3);
  const size = new Float32Array(CAPACITY), opacity = new Float32Array(CAPACITY);
  const particles = Array.from({ length: CAPACITY }, () => ({ life: 0, age: 0, vx: 0, vy: 0, vz: 0, size: 0, opacity: 0 }));
  const geometry = new T.BufferGeometry();
  for (const [name, array, count] of [['position', position, 3], ['color', color, 3], ['size', size, 1], ['opacity', opacity, 1]]) {
    geometry.setAttribute(name, new T.BufferAttribute(array, count).setUsage(T.DynamicDrawUsage));
  }
  const material = new T.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: { ...T.UniformsUtils.clone(T.UniformsLib.fog), pointScale: { value: 400 } },
    vertexShader: `
      attribute vec3 color;
      attribute float size;
      attribute float opacity;
      uniform float pointScale;
      varying vec3 vDustColor;
      varying float vDustOpacity;
      #include <fog_pars_vertex>
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp(size * pointScale / max(0.1, -mvPosition.z), 1.0, 96.0);
        vDustColor = color;
        vDustOpacity = opacity;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      varying vec3 vDustColor;
      varying float vDustOpacity;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float edge = 1.0 - smoothstep(0.08, 1.0, dot(p, p));
        float cloud = edge * edge * vDustOpacity;
        if (cloud < 0.003) discard;
        gl_FragColor = vec4(vDustColor, cloud);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const points = new T.Points(geometry, material); points.name = 'RinneGroundDust';
  points.frustumCulled = false; points.visible = false; scene.add(points);
  const tint = new T.Color(); let cursor = 0;
  function emit({ x, z, y = .04, surface = 'soil', speed = 2, yaw = 0, skid = false, carried = false, quality = 0 }) {
    if (surface === 'wood' || surface === 'water') return;
    const energy = Math.min(1, Math.max(.12, speed / 8));
    const count = Math.min(quality >= 2 ? 4 : 8, Math.ceil((surface === 'stone' ? 1 : surface === 'grass' ? 2 : 3) + energy * (skid ? 5 : 2)));
    tint.set(surface === 'grass' ? 0x8c9870 : surface === 'stone' ? 0xbab8af : 0xc8af88);
    for (let n = 0; n < count; n++) {
      const i = cursor++ % CAPACITY, p = particles[i], a = Math.random() * Math.PI * 2;
      p.life = .32 + Math.random() * .28; p.age = 0;
      p.vx = Math.cos(a) * (.12 + energy * .35) - Math.sin(yaw) * speed * .055;
      p.vz = Math.sin(a) * (.12 + energy * .35) - Math.cos(yaw) * speed * .055;
      p.vy = .18 + Math.random() * .22;
      p.size = (.13 + energy * .25 + Math.random() * .08) * (carried ? .88 : 1) * (skid ? 1.2 : 1);
      position[i * 3] = x + Math.cos(a) * .06; position[i * 3 + 1] = y; position[i * 3 + 2] = z + Math.sin(a) * .06;
      color[i * 3] = tint.r; color[i * 3 + 1] = tint.g; color[i * 3 + 2] = tint.b;
      size[i] = p.size; p.opacity = surface === 'grass' ? .2 : .34; opacity[i] = p.opacity;
    }
    for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;
    points.visible = true;
  }
  function update(dt) {
    let alive = 0;
    for (let i = 0; i < CAPACITY; i++) {
      const p = particles[i]; if (p.life <= 0) continue;
      p.age += dt;
      if (p.age >= p.life) { p.life = 0; opacity[i] = 0; continue; }
      alive++; const t = p.age / p.life;
      position[i * 3] += p.vx * dt; position[i * 3 + 1] += p.vy * dt; position[i * 3 + 2] += p.vz * dt;
      p.vy *= Math.exp(-3 * dt); size[i] = p.size * (1 + t * 1.6);
      opacity[i] = (1 - t) * (1 - t) * p.opacity;
    }
    points.visible = alive > 0;
    material.uniforms.pointScale.value = Math.max(1, canvas.height) / (2 * Math.tan(camera.fov * Math.PI / 360));
    for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;
  }
  function clear() { for (const p of particles) p.life = 0; opacity.fill(0); geometry.attributes.opacity.needsUpdate = true; points.visible = false; }
  function dispose() { points.removeFromParent(); geometry.dispose(); material.dispose(); }
  return { emit, update, clear, dispose };
}
