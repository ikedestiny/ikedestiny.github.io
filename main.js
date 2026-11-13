import * as THREE from "three";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
document.getElementById("year").textContent = new Date().getFullYear();

/* ---------------------------------------------------------------
   3D SCENE — a living microservice graph: a core service, orbiting
   service nodes, and "Kafka messages" streaming along the links.
---------------------------------------------------------------- */
const canvas = document.getElementById("scene");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch (e) {
  canvas.style.display = "none";
}

if (renderer) initScene();

function initScene() {
  const ACCENT = new THREE.Color("#57f2c4");
  const ACCENT2 = new THREE.Color("#8b7bff");
  const ACCENT3 = new THREE.Color("#ff7ac6");

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x060914, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x060914, 0.035);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 0, 11);

  const world = new THREE.Group();
  scene.add(world);
  const cluster = new THREE.Group();
  world.add(cluster);

  // --- Core service ---------------------------------------------------
  const core = new THREE.Group();
  cluster.add(core);
  const coreShell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.5, 1),
    new THREE.MeshBasicMaterial({ color: ACCENT, wireframe: true, transparent: true, opacity: 0.55 })
  );
  core.add(coreShell);
  const coreInner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.85, 0),
    new THREE.MeshBasicMaterial({ color: ACCENT2, wireframe: true, transparent: true, opacity: 0.9 })
  );
  core.add(coreInner);
  core.add(makeGlow(ACCENT, 6, 0.55));
  core.add(makeLabel("spring-boot-core", "#57f2c4", 1.0, new THREE.Vector3(0, -2.2, 0)));

  // orbit rings
  const rings = [];
  [[2.6, ACCENT2, 0.25], [3.4, ACCENT, 0.12], [4.3, ACCENT3, 0.1]].forEach(([r, c, o], i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.008, 6, 160),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o })
    );
    ring.rotation.x = Math.PI / 2 + (i - 1) * 0.35;
    ring.rotation.y = i * 0.5;
    cluster.add(ring);
    rings.push(ring);
  });

  // --- Service nodes --------------------------------------------------
  const services = [
    { name: "api-gateway", color: ACCENT },
    { name: "auth-service", color: ACCENT2 },
    { name: "kafka", color: ACCENT3 },
    { name: "redis", color: ACCENT3 },
    { name: "postgres", color: ACCENT2 },
    { name: "email-notifier", color: ACCENT },
    { name: "llm-quiz", color: ACCENT2 },
  ];
  const nodes = [];
  services.forEach((s, i) => {
    const a = (i / services.length) * Math.PI * 2;
    const r = 4.2 + (i % 2) * 0.9;
    const pos = new THREE.Vector3(Math.cos(a) * r, Math.sin(i * 1.7) * 1.6, Math.sin(a) * r);
    const g = new THREE.Group();
    g.position.copy(pos);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.55, 0.55),
      new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.18 })
    );
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(box.geometry),
      new THREE.LineBasicMaterial({ color: s.color, transparent: true, opacity: 0.95 })
    );
    g.add(box, edges, makeGlow(s.color, 1.8, 0.35));
    g.add(makeLabel(s.name, "#" + s.color.getHexString(), 0.55, new THREE.Vector3(0, -0.7, 0)));
    g.userData = { base: pos.clone(), phase: i * 1.3, spin: 0.3 + (i % 3) * 0.2, box: [box, edges] };
    cluster.add(g);
    nodes.push(g);
  });

  // --- Links ----------------------------------------------------------
  const links = [];
  nodes.forEach((n, i) => links.push([null, i]));               // core <-> each node
  [[0, 1], [1, 2], [2, 5], [2, 3], [1, 4], [0, 6], [6, 4]].forEach((p) => links.push(p));
  const linePositions = new Float32Array(links.length * 6);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  const lineMesh = new THREE.LineSegments(
    lineGeo,
    new THREE.LineBasicMaterial({ color: 0x8b7bff, transparent: true, opacity: 0.22 })
  );
  cluster.add(lineMesh);

  // --- Messages (particles travelling along links) ---------------------
  const MSG = reduceMotion ? 0 : 90;
  const msgPos = new Float32Array(MSG * 3);
  const msgCol = new Float32Array(MSG * 3);
  const msgs = [];
  const palette = [ACCENT, ACCENT2, ACCENT3];
  for (let i = 0; i < MSG; i++) {
    const c = palette[i % 3];
    msgCol.set([c.r, c.g, c.b], i * 3);
    msgs.push({ link: i % links.length, t: Math.random(), speed: 0.12 + Math.random() * 0.35, dir: Math.random() > 0.5 ? 1 : -1 });
  }
  const msgGeo = new THREE.BufferGeometry();
  msgGeo.setAttribute("position", new THREE.BufferAttribute(msgPos, 3));
  msgGeo.setAttribute("color", new THREE.BufferAttribute(msgCol, 3));
  const msgPoints = new THREE.Points(
    msgGeo,
    new THREE.PointsMaterial({ size: 0.13, vertexColors: true, map: dotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  cluster.add(msgPoints);

  // --- Starfield ------------------------------------------------------
  const STARS = window.innerWidth < 700 ? 900 : 1800;
  const starPos = new Float32Array(STARS * 3);
  for (let i = 0; i < STARS; i++) {
    const r = 25 + Math.random() * 60;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    starPos.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph)], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ size: 0.18, color: 0xaab4ff, map: dotTexture(), transparent: true, opacity: 0.7, depthWrite: false, fog: false })
  );
  scene.add(stars);

  // --- Grid floor -----------------------------------------------------
  const grid = new THREE.GridHelper(80, 60, 0x8b7bff, 0x8b7bff);
  grid.material.transparent = true;
  grid.material.opacity = 0.07;
  grid.position.y = -6;
  world.add(grid);

  // --- Interaction state ---------------------------------------------
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  });
  let scrollP = 0, scrollT = 0;
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollT = max > 0 ? window.scrollY / max : 0;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  let wide = true;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    wide = w > 900;
  }
  window.addEventListener("resize", resize);
  resize();

  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  const nodePos = (idx, out) => (idx === null ? out.set(0, 0, 0) : out.copy(nodes[idx].position));

  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const m = reduceMotion ? 0 : 1;

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    scrollP += (scrollT - scrollP) * 0.06;

    // core
    coreShell.rotation.y += dt * 0.25 * m;
    coreShell.rotation.x += dt * 0.1 * m;
    coreInner.rotation.y -= dt * 0.6 * m;
    coreInner.rotation.z += dt * 0.3 * m;
    const pulse = 1 + Math.sin(t * 2) * 0.04 * m;
    core.scale.setScalar(pulse);
    rings.forEach((r, i) => (r.rotation.z += dt * (0.1 + i * 0.05) * m));

    // nodes float
    nodes.forEach((n) => {
      const u = n.userData;
      n.position.y = u.base.y + Math.sin(t * 0.8 + u.phase) * 0.35 * m;
      u.box.forEach((b) => { b.rotation.x += dt * u.spin * m; b.rotation.y += dt * u.spin * m; });
    });

    // links
    links.forEach(([a, b], i) => {
      nodePos(a, tmpA); nodePos(b, tmpB);
      linePositions.set([tmpA.x, tmpA.y, tmpA.z, tmpB.x, tmpB.y, tmpB.z], i * 6);
    });
    lineGeo.attributes.position.needsUpdate = true;

    // messages
    msgs.forEach((p, i) => {
      p.t += dt * p.speed * p.dir;
      if (p.t > 1 || p.t < 0) {
        p.link = (Math.random() * links.length) | 0;
        p.dir = Math.random() > 0.5 ? 1 : -1;
        p.t = p.dir > 0 ? 0 : 1;
      }
      const [a, b] = links[p.link];
      nodePos(a, tmpA); nodePos(b, tmpB);
      tmpA.lerp(tmpB, p.t);
      msgPos[i * 3] = tmpA.x; msgPos[i * 3 + 1] = tmpA.y; msgPos[i * 3 + 2] = tmpA.z;
    });
    if (MSG) msgGeo.attributes.position.needsUpdate = true;

    // scroll choreography: cluster drifts right in hero, swings around as you scroll
    const heroX = wide ? 4.8 : 0;
    cluster.position.x = THREE.MathUtils.lerp(heroX, wide ? -3.2 : 0, Math.sin(scrollP * Math.PI));
    cluster.position.y = wide ? 0 : 4.2;
    cluster.rotation.y = t * 0.06 * m + scrollP * Math.PI * 2.2;
    cluster.rotation.x = 0.25 + Math.sin(scrollP * Math.PI) * 0.35;
    camera.position.z = (wide ? 11 : 17) +Math.sin(scrollP * Math.PI) * 4;
    camera.position.y = -scrollP * 2;

    world.rotation.y = mouse.x * 0.18;
    world.rotation.x = mouse.y * 0.1;
    stars.rotation.y = t * 0.01 * m + scrollP * 0.6;
    camera.lookAt(0, -scrollP * 2, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
}

function makeGlow(color, size, opacity) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  const col = "#" + color.getHexString();
  grd.addColorStop(0, col);
  grd.addColorStop(0.25, col + "88");
  grd.addColorStop(1, col + "00");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  return s;
}

var _dot;
function dotTexture() {
  if (_dot) return _dot;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.4, "rgba(255,255,255,.6)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _dot = new THREE.CanvasTexture(c);
  return _dot;
}

function makeLabel(text, color, height, offset) {
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  const font = "600 44px 'JetBrains Mono', monospace";
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 40;
  c.width = w; c.height = 72;
  g.font = font;
  g.fillStyle = "rgba(10,14,30,0.75)";
  roundRect(g, 0, 0, w, 72, 20); g.fill();
  g.strokeStyle = color + "99"; g.lineWidth = 3;
  roundRect(g, 1.5, 1.5, w - 3, 69, 19); g.stroke();
  g.fillStyle = color;
  g.textBaseline = "middle";
  g.fillText(text, 20, 38);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const h = height * 0.5;
  s.scale.set(h * (w / 72), h, 1);
  s.position.copy(offset);
  return s;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/* ---------------------------------------------------------------
   3D TAG SPHERE (CSS transforms)
---------------------------------------------------------------- */
(function tagSphere() {
  const el = document.getElementById("tag-sphere");
  const words = ["Kotlin", "Java", "Spring Boot", "Kafka", "Redis", "PostgreSQL", "Docker", "gRPC", "REST", "Hibernate", "JPA", "MongoDB", "Liquibase", "Linux", "Git", "Gradle", "Maven", "Python", "SQL", "Spring Security", "Microservices", "Heroku", "Compose", "Bash"];
  const colors = ["#57f2c4", "#8b7bff", "#ff7ac6", "#e8ecf8"];
  const items = words.map((w, i) => {
    const s = document.createElement("span");
    s.textContent = w;
    s.style.color = colors[i % colors.length];
    el.appendChild(s);
    const phi = Math.acos(1 - (2 * (i + 0.5)) / words.length);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    return { s, x: Math.sin(phi) * Math.cos(theta), y: Math.cos(phi), z: Math.sin(phi) * Math.sin(theta), w: 0 };
  });
  requestAnimationFrame(() => items.forEach((it) => (it.w = it.s.offsetWidth)));

  let ax = 0.3, ay = 0, vx = 0.0025, vy = 0.004;
  const wrap = el.parentElement;
  wrap.addEventListener("pointermove", (e) => {
    const r = wrap.getBoundingClientRect();
    vy = ((e.clientX - r.left) / r.width - 0.5) * 0.03;
    vx = -((e.clientY - r.top) / r.height - 0.5) * 0.03;
  });
  wrap.addEventListener("pointerleave", () => { vx = 0.0025; vy = 0.004; });

  function tick() {
    const R = Math.min(wrap.clientWidth, wrap.clientHeight) * 0.42;
    if (!reduceMotion) { ax += vx; ay += vy; }
    const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
    items.forEach((it) => {
      let x = it.x * cy + it.z * sy;
      let z = -it.x * sy + it.z * cy;
      let y = it.y * cx - z * sx;
      z = it.y * sx + z * cx;
      const scale = 0.65 + (z + 1) * 0.35;
      it.s.style.transform = `translate3d(${x * R - it.w / 2}px, ${y * R - 10}px, ${z * R}px) scale(${scale})`;
      it.s.style.opacity = (0.25 + (z + 1) * 0.375).toFixed(2);
      it.s.style.zIndex = Math.round(z * 100) + 100;
    });
    requestAnimationFrame(tick);
  }
  tick();
})();

/* ---------------------------------------------------------------
   Card tilt + scroll reveal
---------------------------------------------------------------- */
if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
  document.querySelectorAll(".tilt").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateY(${px * 10}deg) rotateX(${-py * 10}deg) translateZ(6px)`;
    });
    card.addEventListener("pointerleave", () => (card.style.transform = ""));
  });
}

const revealEls = document.querySelectorAll(".section-title, .glass, .big, .big-btn, .socials, .more");
revealEls.forEach((el) => el.classList.add("reveal"));
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
  { threshold: 0.12 }
);
revealEls.forEach((el) => io.observe(el));
