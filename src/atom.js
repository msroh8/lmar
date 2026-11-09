// نموذج بور ثلاثي الأبعاد لذرة العنصر المختار
import * as THREE from 'three';

const MAX_ELECTRONS = 118;
const MAX_NUCLEONS = 72;
const INK = 0x1c1f55;

export class AtomView {
  constructor(canvas, reduceMotion) {
    this.canvas = canvas;
    this.reduceMotion = reduceMotion;
    this.running = false;
    this.spin = { x: 0.08, y: -0.32 };
    this.shells = [];

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8888bb, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 5, 6);
    this.scene.add(key);

    this.atom = new THREE.Group();
    this.scene.add(this.atom);

    const sphere = new THREE.SphereGeometry(1, 14, 10);
    this.nucleons = new THREE.InstancedMesh(
      sphere,
      new THREE.MeshStandardMaterial({ roughness: 0.42 }),
      MAX_NUCLEONS,
    );
    this.atom.add(this.nucleons);

    this.electrons = new THREE.InstancedMesh(
      sphere,
      new THREE.MeshStandardMaterial({ color: INK, roughness: 0.3 }),
      MAX_ELECTRONS,
    );
    this.electrons.frustumCulled = false;
    this.atom.add(this.electrons);

    this.ringMat = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.42 });
    this.rings = [];
    for (let i = 0; i < 7; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.set(0.82 + i * 0.1, i * 0.24, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 96), this.ringMat);
      pivot.add(ring);
      this.atom.add(pivot);
      this.rings.push({ pivot, ring });
    }

    this.bindDrag();
    this.t0 = performance.now();
    this.tick = this.tick.bind(this);
  }

  bindDrag() {
    let last = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      last = [e.clientX, e.clientY];
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!last) return;
      this.spin.y += (e.clientX - last[0]) * 0.011;
      this.spin.x += (e.clientY - last[1]) * 0.011;
      last = [e.clientX, e.clientY];
      if (this.reduceMotion) this.draw(this.lastTime || 0);
    });
    const end = () => { last = null; };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
  }

  set(el) {
    const n = el.sh.length;
    const gap = 0.72;
    const r0 = 1.25 + Math.min(1, el.z / 40) * 0.35;
    this.shells = el.sh.map((count, i) => ({ count, radius: r0 + i * gap, index: i }));

    this.rings.forEach((r, i) => {
      const on = i < n;
      r.pivot.visible = on;
      if (on) r.ring.scale.setScalar(this.shells[i].radius);
    });

    // النواة: بروتونات ونيوترونات (تُختصر رسوميًا في العناصر الثقيلة)
    const massNo = Math.round(parseFloat(el.m.replace(/[[\]]/g, '')));
    const total = Math.max(1, Math.min(MAX_NUCLEONS, massNo));
    const protonShare = el.z / massNo;
    const radius = 0.2;
    const ball = total === 1 ? 0 : radius * 1.14 * Math.cbrt(total);
    const m = new THREE.Matrix4();
    const proton = new THREE.Color(0xc43a5a);
    const neutron = new THREE.Color(0x4d55a8);
    const golden = Math.PI * (3 - Math.sqrt(5));
    let protonsPlaced = 0;
    for (let i = 0; i < total; i++) {
      const y = total === 1 ? 0 : 1 - (2 * (i + 0.5)) / total;
      const flat = Math.sqrt(Math.max(0, 1 - y * y));
      const a = i * golden;
      const rr = ball * Math.cbrt((i + 0.6) / total);
      m.makeScale(radius, radius, radius);
      m.setPosition(Math.cos(a) * flat * rr, y * rr, Math.sin(a) * flat * rr);
      this.nucleons.setMatrixAt(i, m);
      const wantProton = (i + 1) * protonShare > protonsPlaced + 0.5 - 1e-6;
      if (wantProton) protonsPlaced++;
      this.nucleons.setColorAt(i, wantProton ? proton : neutron);
    }
    this.nucleons.count = total;
    this.nucleons.instanceMatrix.needsUpdate = true;
    this.nucleons.instanceColor.needsUpdate = true;

    this.electrons.count = el.z;
    this.outer = r0 + (n - 1) * gap;
    this.fit();
    if (!this.running) this.draw(this.lastTime || 0);
  }

  fit() {
    const w = this.canvas.clientWidth || 200;
    const h = this.canvas.clientHeight || 160;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const halfV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const halfH = halfV * this.camera.aspect;
    const span = (this.outer || 2) + 0.35;
    this.camera.position.set(0, 0, span / Math.min(halfV, halfH));
    this.camera.lookAt(0, 0, 0);
  }

  draw(t) {
    this.lastTime = t;
    this.atom.rotation.set(this.spin.x, this.spin.y, 0);
    const m = new THREE.Matrix4();
    const v = new THREE.Vector3();
    let k = 0;
    const size = 0.1 + (this.outer ? this.outer * 0.008 : 0);
    for (const sh of this.shells) {
      const pivot = this.rings[sh.index].pivot;
      pivot.updateMatrix();
      const speed = 1.15 / (1 + sh.index * 0.5);
      for (let e = 0; e < sh.count; e++) {
        const a = (e / sh.count) * Math.PI * 2 + t * speed + sh.index * 0.9;
        v.set(Math.cos(a) * sh.radius, Math.sin(a) * sh.radius, 0).applyMatrix4(pivot.matrix);
        m.makeScale(size, size, size);
        m.setPosition(v);
        this.electrons.setMatrixAt(k++, m);
      }
    }
    this.electrons.instanceMatrix.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  tick() {
    if (!this.running) return;
    this.draw((performance.now() - this.t0) / 1000);
    this.raf = requestAnimationFrame(this.tick);
  }

  start() {
    if (this.reduceMotion) {
      this.fit();
      this.draw(0);
      return;
    }
    if (this.running) return;
    this.running = true;
    this.fit();
    this.tick();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
