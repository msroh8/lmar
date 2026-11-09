// الجدول الدوري ثلاثي الأبعاد
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ELEMENTS } from './elements.js';
import { AtomView } from './atom.js';

/* ------------------------------ الثوابت ------------------------------ */

const CATS = {
  alkali:     { ar: 'فلزات قلوية',          fill: '#FDB1B3', edge: '#C9606A' },
  alkaline:   { ar: 'فلزات قلوية أرضية',    fill: '#FEE2B4', edge: '#D9A65E' },
  transition: { ar: 'فلزات انتقالية',       fill: '#FFF8A8', edge: '#C9BA4E' },
  pblock:     { ar: 'فلزات الفئة p',        fill: '#C9EFD5', edge: '#7DAE7C' },
  metalloid:  { ar: 'أشباه الفلزات',        fill: '#C1EDFF', edge: '#5FA6B4' },
  nonmetal:   { ar: 'لا فلزات',             fill: '#BEE0F5', edge: '#4F86A6' },
  halogen:    { ar: 'هالوجينات',            fill: '#DAC9E4', edge: '#9A7FB2' },
  noble:      { ar: 'غازات نبيلة',          fill: '#CAC6DD', edge: '#7C7399' },
  lanthanide: { ar: 'لانثانيدات',           fill: '#FDDCF2', edge: '#C888B4' },
  actinide:   { ar: 'أكتينيدات',            fill: '#FFB7E1', edge: '#C25B9B' },
};

const VIEWS = {
  table:  { caption: matchMedia('(pointer: coarse)').matches ? 'حرّك إصبعك لتدوير الجدول، وقرّب بإصبعين للتكبير، واضغط أي عنصر لاستكشاف ذرته.' : 'اسحب لتدوير الجدول، واضغط أي عنصر لاستكشاف ذرته.', dir: [-0.17, 0.16, 1] },
  towers: { caption: 'ارتفاع كل برج يمثل الكتلة الذرية للعنصر.', dir: [-0.42, 0.8, 1] },
  helix:  { caption: 'العناصر مرتبة حسب العدد الذري، ويبدأ الهيدروجين من الأعلى.', dir: [0, 0.3, 1] },
};

const INK = '#1C1F55';
const FONT = 'Alexandria, "Segoe UI", Tahoma, sans-serif';
const PITCH = 1.09;
const DEPTH = 0.2;
const CY = 5.25;

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const smallTouch = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;

function massValue(el) { return parseFloat(el.m.replace(/[[\]]/g, '')); }

function cellOf(el) {
  if (el.z >= 57 && el.z <= 71) return { col: el.z - 57 + 3.5, row: 8.5 };
  if (el.z >= 89 && el.z <= 103) return { col: el.z - 89 + 3.5, row: 9.5 };
  return { col: el.g, row: el.p };
}

const xOf = (col) => (col - 9.5) * PITCH;
const yOf = (row) => (CY - row) * PITCH;

/* ------------------------------ الرسم على البلاطات ------------------------------ */

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, maxWidth, weight, size) {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  const w = ctx.measureText(text).width;
  if (w > maxWidth) {
    s = size * (maxWidth / w);
    ctx.font = `${weight} ${s}px ${FONT}`;
  }
}

function tileBase(ctx, S, cat) {
  ctx.fillStyle = cat.fill;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = cat.edge;
  ctx.lineWidth = S * 0.022;
  roundRectPath(ctx, S * 0.03, S * 0.03, S * 0.94, S * 0.94, S * 0.08);
  ctx.stroke();
}

function makeTexture(canvas, maxAniso) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(maxAniso, 4);
  return t;
}

function paintElement(el, S) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  tileBase(ctx, S, CATS[el.c]);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';

  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.font = `600 ${S * 0.135}px ${FONT}`;
  ctx.fillText(String(el.z), S * 0.1, S * 0.17);

  ctx.textAlign = 'center';
  fitText(ctx, el.s, S * 0.8, 800, S * 0.37);
  ctx.fillText(el.s, S * 0.5, S * 0.45);

  ctx.font = `500 ${S * 0.105}px ${FONT}`;
  ctx.fillText(el.m, S * 0.5, S * 0.875);

  ctx.direction = 'rtl';
  fitText(ctx, el.ar, S * 0.86, 600, S * 0.125);
  ctx.fillText(el.ar, S * 0.5, S * 0.72);
  return canvas;
}

function paintPlaceholder(range, label, cat, S) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  tileBase(ctx, S, cat);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.direction = 'ltr';
  ctx.font = `700 ${S * 0.19}px ${FONT}`;
  ctx.fillText(range, S * 0.5, S * 0.36);
  ctx.direction = 'rtl';
  fitText(ctx, label, S * 0.86, 600, S * 0.135);
  ctx.fillText(label, S * 0.5, S * 0.64);
  return canvas;
}

/* ------------------------------ الأشكال ------------------------------ */

function roundedShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// منشور بزوايا مستديرة، وجهه الخلفي يعرض النص معدولًا غير معكوس
function prism(w, h, r, depth) {
  const g = new THREE.ExtrudeGeometry(roundedShape(w, h, r), { depth, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(nor.getZ(i)) > 0.9) {
      const u = pos.getX(i) / w + 0.5;
      uv.setXY(i, nor.getZ(i) > 0 ? u : 1 - u, pos.getY(i) / h + 0.5);
    }
  }
  return g;
}

/* ------------------------------ المشهد ------------------------------ */

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('stage'), alpha: true, antialias: true });
} catch (err) {
  fatal();
}

function fatal() {
  $('loader').textContent = 'يتعذر تشغيل العرض ثلاثي الأبعاد في هذا المتصفح. فعّل تسريع العتاد من إعداداته أو افتح الصفحة في متصفح آخر.';
  $('loader').style.padding = '24px';
  $('loader').style.textAlign = 'center';
  throw new Error('WebGL unavailable');
}

renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
if (!smallTouch) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
}

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;
pmrem.dispose();

scene.add(new THREE.HemisphereLight(0xffffff, 0xc9c6ee, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 0.95);
sun.position.set(-7, 12, 16);
sun.castShadow = !smallTouch;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 60 });
sun.shadow.bias = -0.0006;
sun.shadow.radius = 5;
scene.add(sun);

const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = !reduceMotion;
controls.dampingFactor = 0.09;
controls.zoomToCursor = true;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
controls.autoRotateSpeed = 0.7;

const root = new THREE.Group();
scene.add(root);

/* ------------------------------ اللوحة والبلاطات ------------------------------ */

const boardW = 18 * PITCH + 0.8;
const boardTop = yOf(1) + 1.16;
const boardBottom = yOf(9.5) - 0.9;
const boardH = boardTop - boardBottom;
const boardCY = (boardTop + boardBottom) / 2;

function paintBoard() {
  const W = 2048;
  const H = Math.round((W * boardH) / boardW);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const toX = (x) => ((x + boardW / 2) / boardW) * W;
  const toY = (y) => ((boardTop - y) / boardH) * H;

  ctx.fillStyle = '#2C2D78';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  ctx.direction = 'rtl';
  ctx.fillStyle = '#F3F0FF';
  const titleWidth = ((9.2 * PITCH) / boardW) * W;
  fitText(ctx, 'الجدول الدوري للعناصر', titleWidth, 800, W * 0.05);
  ctx.fillText('الجدول الدوري للعناصر', toX(xOf(7.5)), toY(yOf(2.1)));

  ctx.direction = 'ltr';
  ctx.fillStyle = 'rgba(243,240,255,.86)';
  ctx.font = `600 ${W * 0.0155}px ${FONT}`;
  const top = { 1: 1, 2: 2, 13: 2, 14: 2, 15: 2, 16: 2, 17: 2, 18: 1 };
  for (let g = 1; g <= 18; g++) {
    const row = top[g] || 4;
    ctx.fillText(String(g), toX(xOf(g)), toY(yOf(row) + 0.71));
  }
  return canvas;
}

const tileGeo = prism(1, 1, 0.1, DEPTH);
const tiles = [];
const meshes = [];
let board;
const maxAniso = renderer.capabilities.getMaxAnisotropy();
const TEX = smallTouch ? 200 : 256;

function addTile(canvas, catKey, data) {
  const cat = CATS[catKey];
  const side = new THREE.Color(cat.edge);
  const capMat = new THREE.MeshStandardMaterial({ map: makeTexture(canvas, maxAniso), roughness: 0.38, metalness: 0 });
  const sideMat = new THREE.MeshStandardMaterial({ color: side.clone(), roughness: 0.45 });
  const mesh = new THREE.Mesh(tileGeo, [capMat, sideMat]);
  mesh.castShadow = !smallTouch;
  root.add(mesh);
  const t = {
    ...data, mesh, capMat, sideMat, side, cat: catKey,
    tp: new THREE.Vector3(), tq: new THREE.Quaternion(), ts: new THREE.Vector3(1, 1, 1), td: 0, d: 0, delay: 0,
  };
  mesh.userData.tile = t;
  tiles.push(t);
  meshes.push(mesh);
  return t;
}

let boardPrinted;
let boardPlain;

function syncBoard() {
  const mat = board.material[0];
  mat.map = view === 'towers' ? boardPlain : boardPrinted;
}

function build() {
  ELEMENTS.forEach((el) => {
    addTile(paintElement(el, TEX), el.c, { el, cell: cellOf(el) });
  });
  addTile(paintPlaceholder('57-71', 'لانثانيدات', CATS.lanthanide, TEX), 'lanthanide', { filterOnly: true, cell: { col: 3, row: 6 } });
  addTile(paintPlaceholder('89-103', 'أكتينيدات', CATS.actinide, TEX), 'actinide', { filterOnly: true, cell: { col: 3, row: 7 } });

  const plain = document.createElement('canvas');
  plain.width = plain.height = 4;
  const pc = plain.getContext('2d');
  pc.fillStyle = '#2C2D78';
  pc.fillRect(0, 0, 4, 4);
  boardPlain = makeTexture(plain, 1);
  boardPrinted = makeTexture(paintBoard(), maxAniso);

  const boardGeo = prism(boardW, boardH, 0.38, 0.1);
  board = new THREE.Mesh(boardGeo, [
    new THREE.MeshStandardMaterial({ map: boardPrinted, roughness: 0.75 }),
    new THREE.MeshStandardMaterial({ color: 0x1b1c58, roughness: 0.7 }),
  ]);
  board.position.set(0, boardCY, -DEPTH / 2 - 0.09);
  board.receiveShadow = !smallTouch;
  root.add(board);
}

/* ------------------------------ طرق العرض ------------------------------ */

const IDENT = new THREE.Quaternion();
const helixR = 4;
const helixStep = (Math.PI * 2) / 20;
const helixRise = 1.32 / 20;
const towerH = (el) => 0.25 + (massValue(el) / 294) * 6;

function base(t, view) {
  const x = xOf(t.cell.col);
  const y = yOf(t.cell.row);
  if (view === 'table') return { p: new THREE.Vector3(x, y, 0), q: IDENT, sz: 1, hide: false };
  if (view === 'towers') {
    const h = t.el ? towerH(t.el) : 0.25;
    return { p: new THREE.Vector3(x, 2 * boardCY - y, h / 2 - DEPTH / 2), q: IDENT, sz: h / DEPTH, hide: false };
  }
  if (!t.el) return { p: new THREE.Vector3(0, 0, 0), q: IDENT, sz: 1, hide: true };
  const i = t.el.z - 1;
  const a = i * helixStep;
  return {
    p: new THREE.Vector3(Math.sin(a) * helixR, 118 * helixRise * 0.5 - i * helixRise, Math.cos(a) * helixR),
    q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a),
    sz: 1,
    hide: false,
  };
}

const ROOTS = {
  table:  { rx: 0, y: -boardCY },
  towers: { rx: -Math.PI / 2, y: -1.9 },
  helix:  { rx: 0, y: 0 },
};

function boxPoints(a, b) {
  const pts = [];
  for (const x of [a[0], b[0]]) for (const y of [a[1], b[1]]) for (const z of [a[2], b[2]]) pts.push([x, y, z]);
  return pts;
}

function boundsFor(view) {
  if (view === 'helix') {
    const pts = [];
    for (const t of tiles) {
      if (!t.el) continue;
      const p = base(t, 'helix').p;
      pts.push([p.x * 1.1, p.y + 0.62, p.z * 1.1], [p.x * 1.1, p.y - 0.62, p.z * 1.1]);
    }
    return pts;
  }
  if (view === 'towers') {
    const hx = boardW / 2;
    const hz = boardH / 2 + 0.1;
    return boxPoints([-hx, -1.9, -hz], [hx, 4.6, hz]);
  }
  return boxPoints([-boardW / 2, -boardH / 2, -0.2], [boardW / 2, boardH / 2, 0.3]);
}

/* ------------------------------ الحالة ------------------------------ */

let view = 'table';
let selected = null;
let hovered = null;
let activeCat = null;
let userTouched = false;
let dirty = true;
let selScale = 1.5;

const tmpN = new THREE.Vector3();
function refreshTargets() {
  for (const t of tiles) {
    const b = base(t, view);
    let lift = 0;
    let s = 1;
    let dim = 0;
    if (activeCat) {
      const on = t.cat === activeCat;
      dim = on ? 0 : 1;
      if (on) lift += 0.26;
    }
    if (t === hovered && t !== selected) lift += 0.3;
    if (t === selected) {
      s = selScale;
      lift += 0.5 + selScale * 0.45;
      dim = 0;
    }
    tmpN.set(0, 0, 1).applyQuaternion(b.q);
    t.tp.copy(b.p).addScaledVector(tmpN, lift);
    t.tq.copy(b.q);
    const k = b.hide ? 0.0001 : 1;
    t.ts.set(s * k, s * k, b.sz * k);
    t.td = dim;
  }
  dirty = true;
}

function setDelays(mult) {
  const now = performance.now();
  for (const t of tiles) {
    const order = t.el ? t.el.z : 60;
    t.delay = reduceMotion ? 0 : now + order * mult;
  }
}

/* ------------------------------ الكاميرا وملاءمة الشاشة ------------------------------ */

const off = { x: 0, y: 0, tx: 0, ty: 0 };
let W = 1;
let H = 1;
let fitDistance = 40;
const tween = { on: false, theta: 0, phi: 0, r: 0, target: new THREE.Vector3() };

function safeRect() {
  const s = $('safe');
  return { x: s.offsetLeft, y: s.offsetTop, w: s.offsetWidth, h: s.offsetHeight };
}

function fitDistanceFor(v, dir) {
  const safe = safeRect();
  const fx = Math.max(0.12, safe.w / W) * 0.965;
  const fy = Math.max(0.12, safe.h / H) * 0.955;
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanH = tanV * (W / H);
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(up, dir).normalize();
  const camUp = new THREE.Vector3().crossVectors(dir, right).normalize();
  const corners = boundsFor(v).map((c) => new THREE.Vector3(...c));
  let lo = 2;
  let hi = 600;
  for (let i = 0; i < 36; i++) {
    const d = (lo + hi) / 2;
    let ok = true;
    for (const c of corners) {
      const depth = d - c.dot(dir);
      if (depth <= 0.5 || Math.abs(c.dot(right) / (depth * tanH)) > fx || Math.abs(c.dot(camUp) / (depth * tanV)) > fy) {
        ok = false;
        break;
      }
    }
    if (ok) hi = d; else lo = d;
  }
  return hi;
}

function applyLimits() {
  if (view === 'table') {
    controls.minAzimuthAngle = -1.3;
    controls.maxAzimuthAngle = 1.3;
    controls.minPolarAngle = 0.4;
    controls.maxPolarAngle = 2.3;
  } else if (view === 'towers') {
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = 1.48;
  } else {
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = 0.5;
    controls.maxPolarAngle = 2.6;
  }
}

function openLimits() {
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;
}

function setOffsets() {
  const s = safeRect();
  off.tx = W / 2 - (s.x + s.w / 2);
  off.ty = H / 2 - (s.y + s.h / 2);
}

function updateSelectionScale() {
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = camera.position.distanceTo(controls.target) || fitDistance;
  const pxPerUnit = H / (2 * tanV * dist);
  selScale = THREE.MathUtils.clamp(78 / pxPerUnit, 1.3, 3);
}

// على الشاشات الطولية يقل الميلان ليأخذ الجدول أكبر مساحة ممكنة
function defaultDir() {
  const d = view === 'table' && H > W ? [-0.07, 0.12, 1] : VIEWS[view].dir;
  return new THREE.Vector3(...d).normalize();
}

function frameCamera(animated, keepDirection) {
  setOffsets();
  const dir = keepDirection
    ? camera.position.clone().sub(controls.target).normalize()
    : defaultDir();
  fitDistance = fitDistanceFor(view, dir);
  controls.minDistance = fitDistance * 0.2;
  controls.maxDistance = fitDistance * 1.9;

  const sph = new THREE.Spherical().setFromVector3(dir);
  if (animated && !reduceMotion) {
    openLimits();
    tween.on = true;
    tween.theta = sph.theta;
    tween.phi = sph.phi;
    tween.r = fitDistance;
    tween.target.set(0, 0, 0);
  } else {
    tween.on = false;
    controls.target.set(0, 0, 0);
    camera.position.copy(dir).multiplyScalar(fitDistance);
    camera.lookAt(0, 0, 0);
    off.x = off.tx;
    off.y = off.ty;
    applyLimits();
    controls.update();
  }
  dirty = true;
}

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  if (userTouched) {
    setOffsets();
    off.x = off.tx;
    off.y = off.ty;
    const dir = camera.position.clone().sub(controls.target).normalize();
    fitDistance = fitDistanceFor(view, dir);
    controls.minDistance = fitDistance * 0.2;
    controls.maxDistance = fitDistance * 1.9;
  } else {
    frameCamera(false);
  }
  updateSelectionScale();
  refreshTargets();
  if (atom && selected) atom.fit();
}

/* ------------------------------ لوحة العنصر ------------------------------ */

let atom = null;

function electronConfig(text) {
  return text.split(' ').map((part) => {
    const m = part.match(/^(\d[spdfg])(\d*)$/);
    return m ? `${m[1]}<sup>${m[2] || 1}</sup>` : part;
  }).join(' ');
}

function fillPanel(el) {
  const cat = CATS[el.c];
  const panel = $('panel');
  panel.style.setProperty('--tile', cat.fill);
  panel.style.setProperty('--tile-edge', cat.edge);
  $('pSymbol').textContent = el.s;
  $('pName').textContent = el.ar;
  $('pEn').textContent = el.en;
  const rows = [
    ['العدد الذري', `<bdi>${el.z}</bdi>`],
    ['الكتلة الذرية', `<bdi>${el.m}</bdi>`],
    ['الدورة', `<bdi>${el.p}</bdi>`],
    ['المجموعة', el.g ? `<bdi>${el.g}</bdi>` : 'سلسلة f'],
    ['الفئة', `<bdi>${el.b}</bdi>`],
    ['التصنيف', cat.ar],
    ['إلكترونات المستويات', `<bdi dir="ltr">${el.sh.join(', ')}</bdi>`],
    ['التوزيع الإلكتروني', `<bdi dir="ltr">${electronConfig(el.ec)}</bdi>`],
  ];
  $('facts').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('prev').disabled = el.z === 1;
  $('next').disabled = el.z === 118;
}

function select(tile) {
  selected = tile;
  hovered = null;
  const panel = $('panel');
  const wasOpen = !panel.hidden;
  if (!tile) {
    panel.hidden = true;
    $('ui').classList.remove('has-panel');
    if (atom) atom.stop();
    updateAfterPanel(wasOpen);
    return;
  }
  fillPanel(tile.el);
  panel.hidden = false;
  $('ui').classList.add('has-panel');
  if (!atom) atom = new AtomView($('atom'), reduceMotion);
  atom.set(tile.el);
  atom.start();
  updateAfterPanel(!wasOpen);
}

function updateAfterPanel(layoutChanged) {
  if (layoutChanged) {
    if (userTouched) setOffsets();
    else frameCamera(true, false);
  }
  updateSelectionScale();
  refreshTargets();
}

function step(delta) {
  if (!selected) return;
  const t = tiles.find((x) => x.el && x.el.z === selected.el.z + delta);
  if (t) select(t);
}

function moveGrid(dc, dr) {
  if (!selected) return;
  const { col, row } = selected.cell;
  let best = null;
  let bestD = Infinity;
  for (const t of tiles) {
    if (!t.el) continue;
    const c = t.cell.col - col;
    const r = t.cell.row - row;
    if ((dc && Math.sign(c) !== dc) || (dr && Math.sign(r) !== dr)) continue;
    const d = dc ? Math.abs(c) + Math.abs(r) * 40 : Math.abs(r) + Math.abs(c) * 40;
    if (d < bestD) { bestD = d; best = t; }
  }
  if (best) select(best);
}

/* ------------------------------ التفاعل ------------------------------ */

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(meshes, false).find((h) => h.object.visible);
  return hit ? hit.object.userData.tile : null;
}

function setCategory(key) {
  activeCat = activeCat === key ? null : key;
  const legend = $('legend');
  legend.classList.toggle('filtering', !!activeCat);
  legend.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === activeCat)));
  refreshTargets();
}

function setView(v) {
  view = v;
  syncBoard();
  document.querySelectorAll('.views button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  $('caption').textContent = VIEWS[v].caption;
  controls.autoRotate = v === 'helix' && !reduceMotion;
  userTouched = false;
  frameCamera(true, false);
  setDelays(3.2);
  updateSelectionScale();
  refreshTargets();
}

function bindCanvas() {
  const el = renderer.domElement;
  let down = null;
  el.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  el.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 600;
    down = null;
    if (moved > 8 || !quick) return;
    const t = pick(e);
    if (!t) { if (selected) select(null); return; }
    if (t.filterOnly) { setCategory(t.cat); return; }
    select(t === selected ? null : t);
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const t = pick(e);
    if (t !== hovered) {
      hovered = t;
      el.style.cursor = t ? 'pointer' : 'grab';
      refreshTargets();
    }
  });
  el.addEventListener('pointerleave', () => {
    if (hovered) { hovered = null; refreshTargets(); }
  });
  controls.addEventListener('start', () => {
    userTouched = true;
    tween.on = false;
    controls.autoRotate = false;
    applyLimits();
  });
  controls.addEventListener('change', () => { dirty = true; });
  controls.addEventListener('end', () => { updateSelectionScale(); if (selected) refreshTargets(); });
}

const normalize = (s) => s.trim().toLowerCase()
  .replace(/[ً-ْ]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/غ/g, 'ج')
  .replace(/^ال/, '');

const ALIASES = { Zn: 'زنك', Mg: 'مغنيسيوم مغنزيوم', Si: 'سليكون', W: 'ولفرام', Sr: 'سترونشيوم', Cs: 'سيسيوم', Kr: 'كربتون', Al: 'المونيوم', Ga: 'جاليوم', Xe: 'زينون', Bi: 'بيزموت', Nh: 'nihonium' };

function searchIndex() {
  return tiles.filter((t) => t.el).map((t) => ({
    t,
    keys: [normalize(t.el.ar), ...(ALIASES[t.el.s] || '').split(' ').filter(Boolean).map(normalize), t.el.en.toLowerCase()],
    sym: t.el.s.toLowerCase(),
    num: String(t.el.z),
  }));
}

function bindSearch() {
  const input = $('q');
  const list = $('results');
  const index = searchIndex();
  let current = [];

  const close = () => { list.hidden = true; list.innerHTML = ''; current = []; };
  const choose = (t) => {
    input.value = '';
    input.blur();
    close();
    select(t);
  };

  input.addEventListener('input', () => {
    const q = normalize(input.value);
    if (!q) { close(); return; }
    const scored = [];
    for (const it of index) {
      let score = -1;
      if (it.num === q || it.sym === q) score = 0;
      else if (it.keys.some((k) => k === q)) score = 1;
      else if (it.keys.some((k) => k.startsWith(q))) score = 2;
      else if (it.keys.some((k) => k.includes(q))) score = 3;
      if (score >= 0) scored.push([score, it.t]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].el.z - b[1].el.z);
    current = scored.slice(0, 6).map((x) => x[1]);
    list.hidden = false;
    list.innerHTML = '';
    if (!current.length) {
      const li = document.createElement('li');
      li.className = 'none';
      li.textContent = 'لا يوجد عنصر بهذا الاسم. جرّب الرمز مثل Fe أو العدد الذري مثل 26.';
      list.append(li);
      return;
    }
    current.forEach((t, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      if (i === 0) btn.className = 'hit';
      const b = document.createElement('b');
      b.dir = 'ltr';
      b.textContent = t.el.s;
      const span = document.createElement('span');
      span.textContent = t.el.ar;
      const small = document.createElement('small');
      small.textContent = t.el.z;
      btn.append(b, span, small);
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); choose(t); });
      btn.addEventListener('click', () => choose(t));
      li.append(btn);
      list.append(li);
    });
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && current[0]) { e.preventDefault(); choose(current[0]); }
    if (e.key === 'Escape') { input.value = ''; close(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
}

function bindUI() {
  document.querySelectorAll('.views button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  $('reset').addEventListener('click', () => {
    if (activeCat) setCategory(activeCat);
    if (selected) select(null);
    setView(view);
  });
  $('close').addEventListener('click', () => select(null));
  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));

  const legend = $('legend');
  Object.entries(CATS).forEach(([key, c]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.cat = key;
    b.textContent = c.ar;
    b.style.setProperty('--c', c.fill);
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => setCategory(key));
    legend.append(b);
  });

  const sr = $('srlist');
  tiles.filter((t) => t.el).forEach((t) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${t.el.ar}، الرمز ${t.el.s}، العدد الذري ${t.el.z}`;
    b.addEventListener('click', () => select(t));
    li.append(b);
    sr.append(li);
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape' && selected) select(null);
    if (!selected) return;
    const moves = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const mv = moves[e.key];
    if (mv) { e.preventDefault(); moveGrid(mv[0], mv[1]); }
  });

  let raf = 0;
  const onResize = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(resize);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  new ResizeObserver(onResize).observe($('safe'));
}

/* ------------------------------ الحلقة الرئيسية ------------------------------ */

let last = performance.now();
const targetRoot = { rx: ROOTS.table.rx, y: ROOTS.table.y };
const sphNow = new THREE.Spherical();
const offV = new THREE.Vector3();

function angleDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 8.5);

  for (const t of tiles) {
    if (now < t.delay) { dirty = true; continue; }
    const m = t.mesh;
    const moving = m.position.distanceToSquared(t.tp) > 1e-5
      || 1 - Math.abs(m.quaternion.dot(t.tq)) > 1e-6
      || m.scale.distanceToSquared(t.ts) > 1e-5
      || Math.abs(t.d - t.td) > 0.003;
    if (!moving) continue;
    m.position.lerp(t.tp, k);
    m.quaternion.slerp(t.tq, k);
    m.scale.lerp(t.ts, k);
    t.d += (t.td - t.d) * k;
    const light = 1 - t.d * 0.74;
    t.capMat.color.setScalar(light);
    t.sideMat.color.copy(t.side).multiplyScalar(light);
    m.visible = m.scale.x > 0.002;
    dirty = true;
  }

  const rt = ROOTS[view];
  if (Math.abs(root.rotation.x - rt.rx) > 1e-4 || Math.abs(root.position.y - rt.y) > 1e-4) {
    root.rotation.x += (rt.rx - root.rotation.x) * k;
    root.position.y += (rt.y - root.position.y) * k;
    dirty = true;
  }
  const boardTarget = view === 'helix' ? 0.0001 : 1;
  if (board && Math.abs(board.scale.x - boardTarget) > 1e-4) {
    const v = board.scale.x + (boardTarget - board.scale.x) * k;
    board.scale.setScalar(v);
    board.visible = v > 0.002;
    dirty = true;
  }

  if (Math.abs(off.x - off.tx) > 0.05 || Math.abs(off.y - off.ty) > 0.05) {
    off.x += (off.tx - off.x) * k;
    off.y += (off.ty - off.y) * k;
    dirty = true;
  }

  if (tween.on) {
    offV.copy(camera.position).sub(controls.target);
    sphNow.setFromVector3(offV);
    const dTheta = angleDelta(sphNow.theta, tween.theta);
    const dPhi = tween.phi - sphNow.phi;
    const dR = tween.r - sphNow.radius;
    sphNow.theta += dTheta * k;
    sphNow.phi += dPhi * k;
    sphNow.radius += dR * k;
    controls.target.lerp(tween.target, k);
    offV.setFromSpherical(sphNow);
    camera.position.copy(controls.target).add(offV);
    camera.lookAt(controls.target);
    dirty = true;
    if (Math.abs(dTheta) < 0.002 && Math.abs(dPhi) < 0.002 && Math.abs(dR) < 0.02) {
      tween.on = false;
      applyLimits();
      updateSelectionScale();
      if (selected) refreshTargets();
    }
  } else if (controls.update()) {
    dirty = true;
  }

  if (dirty) {
    camera.setViewOffset(W, H, off.x, off.y, W, H);
    renderer.render(scene, camera);
    dirty = false;
  }
}

/* ------------------------------ البدء ------------------------------ */

async function start() {
  try {
    await Promise.all([
      document.fonts.load(`800 40px Alexandria`, 'الجدول H'),
      document.fonts.load(`600 40px Alexandria`, 'الجدول H'),
      document.fonts.load(`500 40px Alexandria`, '1.008'),
    ]);
  } catch (err) { /* تُستخدم خطوط النظام عند تعذر تحميل الخط */ }

  build();
  bindUI();
  bindCanvas();
  bindSearch();
  $('caption').textContent = VIEWS.table.caption;

  // مشهد الافتتاح: تخرج العناصر من الحلزون وتستقر في الجدول
  for (const t of tiles) {
    if (reduceMotion || !t.el) {
      const b = base(t, 'table');
      t.mesh.position.copy(b.p);
      if (!reduceMotion && !t.el) t.mesh.scale.setScalar(0.0001);
    } else {
      const b = base(t, 'helix');
      t.mesh.position.copy(b.p);
      t.mesh.position.y += boardCY;
      t.mesh.quaternion.copy(b.q);
      t.mesh.scale.setScalar(0.0001);
    }
  }
  root.position.y = ROOTS.table.y;
  if (!reduceMotion) board.scale.setScalar(0.92);

  resize();
  setDelays(13);
  applyLimits();
  refreshTargets();
  requestAnimationFrame((t) => {
    last = t;
    loop(t);
    $('loader').classList.add('done');
    setTimeout(() => $('loader').remove(), 500);
  });

  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => { dirty = true; });
}

start();
