/* ==========================================================================
   scene.js — particle sculpture
   --------------------------------------------------------------------------
   Concept: "from chaos to infrastructure".
   A shell of points starts as a loose sphere and, as you scroll through the
   hero, snaps into an orderly cubic lattice (and relaxes back to a sphere at
   the contact section). Neighbouring points are joined with fine lines so the
   structure reads as a mesh. The cursor pushes and swirls nearby points.

   All motion happens in the vertex shader; the CPU only updates a handful of
   uniforms per frame.
   ========================================================================== */

import * as THREE from '../assets/vendor/three.module.min.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Geometry data ---------- */
function buildStructure(n) {
  const rand = mulberry32(20260);
  const c = (n - 1) / 2;
  const half = 1.6;               // half-size of the cube lattice
  const step = (half * 2) / (n - 1);
  const sphereR = 1.95;
  const thickness = 1;            // two outer lattice layers

  const pts = [];
  const index = new Map();
  for (let ix = 0; ix < n; ix++) {
    for (let iy = 0; iy < n; iy++) {
      for (let iz = 0; iz < n; iz++) {
        const d = Math.max(Math.abs(ix - c), Math.abs(iy - c), Math.abs(iz - c));
        if (d < c - thickness) continue;
        index.set(ix + '|' + iy + '|' + iz, pts.length);
        pts.push({ ix, iy, iz, d });
      }
    }
  }

  const count = pts.length;
  const cube = new Float32Array(count * 3);
  const sphere = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const delay = new Float32Array(count);

  pts.forEach((p, i) => {
    const x = (p.ix - c) * step, y = (p.iy - c) * step, z = (p.iz - c) * step;
    cube.set([x, y, z], i * 3);
    const len = Math.hypot(x, y, z) || 1;
    const layer = c - p.d;                       // 0 = outer, 1 = inner
    const r = sphereR - layer * 0.1;
    sphere.set([(x / len) * r, (y / len) * r, (z / len) * r], i * 3);
    seed[i] = rand();
    delay[i] = ((y + half) / (half * 2)) * 0.4 + rand() * 0.12; // wave from bottom to top
  });

  // Edges between lattice neighbours
  const edges = [];
  const dirs = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  pts.forEach((p, i) => {
    for (const [dx, dy, dz] of dirs) {
      const j = index.get((p.ix + dx) + '|' + (p.iy + dy) + '|' + (p.iz + dz));
      if (j !== undefined) edges.push(i, j);
    }
  });

  return { count, cube, sphere, seed, delay, edges };
}

/* ---------- Shaders ---------- */
const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uMorph;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uRadius;
  uniform float uPointerOn;
  uniform float uAspect;
  uniform vec2  uPointerNDC;

  attribute vec3  aSphere;
  attribute vec3  aCube;
  attribute float aSeed;
  attribute float aDelay;

  varying float vDepth;
  varying float vNear;
  varying float vSeed;

  vec3 structure() {
    float m = smoothstep(aDelay, aDelay + 0.45, uMorph);
    vec3 p = mix(aSphere, aCube, m);

    // slow breathing along the radial direction
    vec3 dir = normalize(p + 1e-4);
    float breathe = sin(uTime * 0.7 + aSeed * 31.4 + p.y * 2.0);
    p += dir * breathe * 0.035 * (1.0 - 0.7 * m);

    // loose turbulence only while a point is mid-transition
    float t = 4.0 * m * (1.0 - m);
    p += vec3(
      sin(uTime * 1.0 + aSeed * 20.0),
      cos(uTime * 0.9 + aSeed * 13.0),
      sin(uTime * 1.1 + aSeed * 7.0)
    ) * 0.18 * t;
    return p;
  }

  void main() {
    vec4 world = modelMatrix * vec4(structure(), 1.0);

    // Cursor interaction measured in screen space, so depth doesn't skew it
    vec4 clip0 = projectionMatrix * viewMatrix * world;
    vec2 ndc = clip0.xy / clip0.w;
    vec2 dd = (ndc - uPointerNDC) * vec2(uAspect, 1.0);
    float dist = length(dd);
    float f = exp(-(dist * dist) / (uRadius * uRadius)) * uPointerOn;
    vec2 away = dd / max(dist, 0.001);
    world.xy += away * f * 0.55 + vec2(-away.y, away.x) * f * 0.14;
    world.z  += f * 0.35;

    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (7.5 / -mv.z);

    vDepth = clamp((-mv.z - 4.8) / 5.2, 0.0, 1.0);
    vNear = f;
    vSeed = aSeed;
  }
`;

const FRAGMENT_POINTS = /* glsl */ `
  uniform vec3  uInk;
  uniform vec3  uAccent;
  uniform float uOpacity;
  varying float vDepth;
  varying float vNear;
  varying float vSeed;

  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float soft = smoothstep(0.5, 0.12, r);
    // accent: points near the cursor, plus a rare few at rest
    float acc = clamp(vNear * 1.4 + step(0.968, vSeed) * 0.9, 0.0, 1.0);
    vec3 col = mix(uInk, uAccent, acc);
    float alpha = soft * mix(0.95, 0.16, vDepth) * uOpacity;
    gl_FragColor = vec4(col, alpha);
  }
`;

const FRAGMENT_LINES = /* glsl */ `
  uniform vec3  uInk;
  uniform vec3  uAccent;
  uniform float uOpacity;
  varying float vDepth;
  varying float vNear;
  varying float vSeed;

  void main() {
    vec3 col = mix(uInk, uAccent, clamp(vNear * 1.6, 0.0, 1.0));
    float alpha = (mix(0.2, 0.025, vDepth) + vNear * 0.35) * uOpacity;
    gl_FragColor = vec4(col, alpha);
  }
`;

/* ---------- Public API ---------- */
export function initScene({ canvas, reducedMotion = false }) {
  const root = document.documentElement;
  const readout = document.getElementById('morph-readout');

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const smallScreen = () => window.innerWidth < 760;
  const lowPower = coarse || smallScreen() || (navigator.hardwareConcurrency || 8) <= 4;
  const gridN = smallScreen() ? 11 : lowPower ? 13 : 15;
  const maxDpr = smallScreen() ? 1.5 : 2;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.z = 7.5;
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);

  const data = buildStructure(gridN);

  const uniforms = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uSize: { value: 2.8 },
    uPixelRatio: { value: dpr },
    uRadius: { value: 0.22 },
    uPointerOn: { value: 0 },
    uAspect: { value: 1 },
    uPointerNDC: { value: new THREE.Vector2(9, 9) },
    uInk: { value: new THREE.Vector3(0.925, 0.91, 0.875) },
    uAccent: { value: new THREE.Vector3(0.784, 0.957, 0.227) },
    uOpacity: { value: 1 },
  };

  // Colours follow the page theme (light theme needs dark points and a deeper green)
  let themeBoost = 1;
  function applyTheme() {
    const light = root.dataset.theme === 'light';
    uniforms.uInk.value.set(...(light ? [0.082, 0.086, 0.071] : [0.925, 0.91, 0.875]));
    uniforms.uAccent.value.set(...(light ? [0.255, 0.435, 0.0] : [0.784, 0.957, 0.227]));
    themeBoost = light ? 1.5 : 1;
    if (reducedMotion) renderFrame(0);
  }
  applyTheme();
  window.addEventListener('themechange', applyTheme);

  // Points
  const pointsGeo = new THREE.BufferGeometry();
  pointsGeo.setAttribute('position', new THREE.BufferAttribute(data.cube, 3));
  pointsGeo.setAttribute('aCube', new THREE.BufferAttribute(data.cube, 3));
  pointsGeo.setAttribute('aSphere', new THREE.BufferAttribute(data.sphere, 3));
  pointsGeo.setAttribute('aSeed', new THREE.BufferAttribute(data.seed, 1));
  pointsGeo.setAttribute('aDelay', new THREE.BufferAttribute(data.delay, 1));
  const pointsMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT_POINTS,
    transparent: true, depthWrite: false,
  });
  const points = new THREE.Points(pointsGeo, pointsMat);
  points.frustumCulled = false;

  // Lines (two vertices per edge, copied from the point data)
  const e = data.edges;
  const lv = e.length;
  const lCube = new Float32Array(lv * 3), lSphere = new Float32Array(lv * 3);
  const lSeed = new Float32Array(lv), lDelay = new Float32Array(lv);
  for (let k = 0; k < lv; k++) {
    const i = e[k];
    lCube.set(data.cube.subarray(i * 3, i * 3 + 3), k * 3);
    lSphere.set(data.sphere.subarray(i * 3, i * 3 + 3), k * 3);
    lSeed[k] = data.seed[i];
    lDelay[k] = data.delay[i];
  }
  const linesGeo = new THREE.BufferGeometry();
  linesGeo.setAttribute('position', new THREE.BufferAttribute(lCube, 3));
  linesGeo.setAttribute('aCube', new THREE.BufferAttribute(lCube, 3));
  linesGeo.setAttribute('aSphere', new THREE.BufferAttribute(lSphere, 3));
  linesGeo.setAttribute('aSeed', new THREE.BufferAttribute(lSeed, 1));
  linesGeo.setAttribute('aDelay', new THREE.BufferAttribute(lDelay, 1));
  const linesMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT_LINES,
    transparent: true, depthWrite: false,
  });
  const lines = new THREE.LineSegments(linesGeo, linesMat);
  lines.frustumCulled = false;

  group.add(lines, points);

  /* ----- layout (responds to viewport) ----- */
  const layout = { heroX: 0, sideX: 0, scale: 1, heroOpacity: 1, sideOpacity: 0.3, heroY: 0 };
  let width = 0, height = 0, docHeight = 1;

  function resize(force) {
    const w = window.innerWidth, h = window.innerHeight;
    // Ignore mobile URL-bar height jitter
    if (!force && coarse && w === width && Math.abs(h - height) < 140) return;
    width = w; height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uAspect.value = camera.aspect;

    const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
    if (w >= 1000) {
      layout.heroX = halfW * 0.56;
      layout.sideX = halfW * 0.72;
      layout.scale = Math.min(0.9, (halfW * 0.44) / 2.7);
      layout.heroOpacity = 1; layout.sideOpacity = 0.17; layout.heroY = -0.1;
    } else if (w >= 760) {
      layout.heroX = halfW * 0.3;
      layout.sideX = halfW * 0.45;
      layout.scale = (halfW * 0.62) / 2.7;
      layout.heroOpacity = 0.7; layout.sideOpacity = 0.14; layout.heroY = 0;
    } else {
      layout.heroX = 0; layout.sideX = 0;
      layout.scale = (halfW * 1.35) / 2.7;
      layout.heroOpacity = 0.45; layout.sideOpacity = 0.14; layout.heroY = 0.4;
    }
    docHeight = Math.max(document.documentElement.scrollHeight, h + 1);
    if (reducedMotion) renderFrame(0);
  }

  /* ----- input ----- */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, inside: false };
  let scrollTarget = window.scrollY, scrollCurrent = scrollTarget;

  function onPointerMove(ev) {
    if (ev.pointerType === 'touch') return;
    pointer.x = (ev.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((ev.clientY / window.innerHeight) * 2 - 1);
    pointer.inside = true;
  }
  const onLeave = () => { pointer.inside = false; };
  const onScroll = () => { scrollTarget = window.scrollY; };
  let resizeRaf = 0;
  const onResize = () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => resize(false));
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  window.addEventListener('blur', onLeave);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  const bodyObserver = 'ResizeObserver' in window
    ? new ResizeObserver(() => { docHeight = Math.max(document.documentElement.scrollHeight, height + 1); })
    : null;
  bodyObserver?.observe(document.body);

  const onContextLost = (ev) => { ev.preventDefault(); stop(); root.classList.add('no-webgl'); };
  canvas.addEventListener('webglcontextlost', onContextLost);

  /* ----- frame ----- */
  let raf = 0, last = performance.now(), idle = 0.6, running = false;
  let slowFrames = 0, qualityLowered = false, lastLabel = '';

  function renderFrame(dt) {
    uniforms.uTime.value += dt;
    idle += dt * 0.07;

    const k = 1 - Math.exp(-dt * 6);
    scrollCurrent = reducedMotion ? 0 : lerp(scrollCurrent, scrollTarget, k);

    // Scroll-driven morph: sphere -> lattice through the hero, back to sphere at the end
    const startT = smooth(clamp(scrollCurrent / (height * 0.95), 0, 1));
    const endT = smooth(clamp((scrollCurrent - (docHeight - height * 2.4)) / (height * 1.3), 0, 1));
    const morph = startT * (1 - endT);
    uniforms.uMorph.value = morph;

    const side = smooth(clamp(scrollCurrent / (height * 0.9), 0, 1));
    const x = lerp(lerp(layout.heroX, layout.sideX, side), 0, endT);
    const y = layout.heroY * (1 - side);
    group.position.set(x, y, 0);
    group.scale.setScalar(layout.scale * (1 + endT * 0.12));

    let opacity = lerp(layout.heroOpacity, layout.sideOpacity, side);
    opacity = lerp(opacity, 0.26, endT);
    uniforms.uOpacity.value = Math.min(1, opacity * themeBoost);

    // Orientation follows the pointer; scroll adds a slow turn
    if (!reducedMotion) {
      pointer.sx = lerp(pointer.sx, pointer.inside ? pointer.x : 0, 1 - Math.exp(-dt * 3));
      pointer.sy = lerp(pointer.sy, pointer.inside ? pointer.y : 0, 1 - Math.exp(-dt * 3));
    }
    group.rotation.y = idle + pointer.sx * 0.5 + scrollCurrent * 0.0011;
    group.rotation.x = 0.32 + Math.sin(idle * 0.6) * 0.05 - pointer.sy * 0.32 + scrollCurrent * 0.0003;

    // Cursor displacement
    const on = pointer.inside && !coarse && !reducedMotion ? 1 : 0;
    uniforms.uPointerOn.value = lerp(uniforms.uPointerOn.value, on, 1 - Math.exp(-dt * 5));
    uniforms.uPointerNDC.value.set(pointer.x, pointer.y);

    renderer.render(scene, camera);

    // Hero readout
    if (readout) {
      const pct = Math.round(morph * 100);
      const label = pct <= 2 ? 'Sphere' : pct >= 98 ? 'Lattice' : 'Morphing ' + pct + '%';
      if (label !== lastLabel) { readout.textContent = label; lastLabel = label; }
    }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    renderFrame(dt);

    // One-time adaptive quality: drop pixel ratio if the device struggles
    if (!qualityLowered && now > 3000) {
      slowFrames = dt > 0.028 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 40 && dpr > 1) {
        qualityLowered = true;
        dpr = Math.max(1, dpr * 0.7);
        renderer.setPixelRatio(dpr);
        uniforms.uPixelRatio.value = dpr;
        renderer.setSize(width, height, false);
      }
    }
  }

  function start() {
    if (running || reducedMotion) return;
    running = true; last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);

  resize(true);
  renderFrame(0);
  start();

  return {
    destroy() {
      stop();
      cancelAnimationFrame(resizeRaf);
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('blur', onLeave);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('themechange', applyTheme);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      bodyObserver?.disconnect();
      pointsGeo.dispose(); linesGeo.dispose();
      pointsMat.dispose(); linesMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
