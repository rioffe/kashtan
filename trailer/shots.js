// The trailer's shots, run inside the game's page (window.__T is the game's module scope: read and set its variables through it).
// Each shot: name; setup() puts the world as the shot wants it (season S, time of day tod, weather, what is lit or built);
// cam(u) gives the camera at u, 0 at the shot's first frame and 1 at its last, as [position, yaw, pitch] (look() makes them);
// warm: frames (at 30 fps) run before the first one is kept, to let leaves fall, rain wet things, the fire catch;
// acam(u): where the shot is heard from in the audio pass, if not from where it is seen.
// How long each shot lasts, the order, which are dropped from a short trailer and the captions are in make_trailer.py.
var T = window.__T, U = { u: 0, f: 0 };
var V = (x, y, z) => new T.V3(x, y, z);
var ease = u => u * u * (3 - 2 * u), mix = (a, b, u) => a + (b - a) * u;
var vmix = (a, b, u) => a.clone().lerp(b, u);
var look = (p, q) => { const d = q.clone().sub(p); return [p, Math.atan2(-d.x, -d.z), Math.atan2(d.y, Math.hypot(d.x, d.z))]; };
var orbit = (c, r, a, y) => V(c.x + Math.sin(a) * r, y, c.z + Math.cos(a) * r);
var clamp01 = x => Math.max(0, Math.min(1, x)), hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// a tilt up a building: the camera eases from `from` to `to`, facing `yawAt`; it starts aimed at height `low` over `base` (the foot
// of the front) and tilts up to the pitch that fits both `base` and `top` (the highest point) in the frame, ending on the whole building
var tiltUp = ({ from, to, yawAt, base, top, low }, u) => { const p = vmix(from, to, ease(u)), db = hdist(p, base);
  const lowP = Math.atan2(low - p.y, db), fit = (Math.atan2(top.y - p.y, hdist(p, top)) + Math.atan2(base.y - p.y, db)) / 2;
  return [p, Math.atan2(-(yawAt.x - p.x), -(yawAt.z - p.z)), mix(lowP, fit, ease(clamp01((u - 0.12) / 0.8)))]; };
function world({ S, tod, weather = 'fair', fov = 50, mode = 'free', lamp = true, cloud }){
  T.S = S; T.sTarget = null; T.drift = false; T.TOD = tod; T.todTarget = null; T.timeSel = null;
  T.weather = weather; const w = (window.__WO || T.WEATHERS)[weather]; Object.assign(T.W, { cloud: cloud ?? w.cloud, rain: w.rain, wet: w.rain, leafWet: w.rain }); const WS = T.WEATHERS; window.__WO = window.__WO || Object.fromEntries(Object.entries(WS).map(([k, v]) => [k, v])); for (const k in window.__WO) WS[k] = window.__WO[k]; if (cloud != null) WS[weather] = Object.assign({}, window.__WO[weather], { cloud });
  T.mode = mode; T.camera.fov = fov; T.camera.near = 0.1; T.camera.updateProjectionMatrix();
  for (const L of T.FLs) L.on = false; for (const n of T.NUTs) n.on = false; T.lastLeaf = T.SP(S).leaf;
  T.deskLamp.on = lamp; { const F = T.fire; F.lit = false; F.flameK = F.emberK = 0; for (const sp of F.smoke){ sp.userData.life = 0; sp.visible = false; } F.on = true; T.updateFire(0.016, 0, 0); }
  T.keys.clear(); window.__camLock = null;
  for (const sm of T.SNOWMEN) sm.g.visible = false;
  T.cat.root.visible = false; T.cat.q = []; T.cat.state = 'hidden'; T.cat.timer = 9999; T.cat.force = null; }
function near(n){ T.camera.near = n; T.camera.updateProjectionMatrix(); }
window.__setU = (u, f) => { U.u = u; U.f = f; };

var A = () => !!window.__AUDIO;
var SHOTS = [
  // SPRING. In from Stabu through the gateway, down the lane towards the tree: a May morning
  { name: 'gate', setup(){ world({ S: 1.62, tod: 0.36 }); },
    cam: u => look(vmix(V(T.ROAD_X + 0.3, 1.62, -57.5), V(T.ROAD_X + 0.3, 1.62, -74), ease(u)), V(T.TREE.x - 6, 5.5, T.TREE.z)) },
  // the chestnut's candles
  { name: 'candles', setup(){ world({ S: 1.66, tod: 0.62, fov: 45 }); },
    cam: u => look(vmix(V(T.TREE.x - 19, 5, T.TREE.z + 13), V(T.TREE.x - 17, 9.5, T.TREE.z + 11), ease(u)), V(T.TREE.x - 2, 10, T.TREE.z)) },
  // rain on the lane
  { name: 'rain', warm: 90, setup(){ world({ S: 1.8, tod: 0.55, weather: 'rain' }); },
    cam: u => look(vmix(V(T.ROAD_X + 0.6, 0.55, -96), V(T.ROAD_X + 0.6, 0.55, -100), ease(u)), V(T.ROAD_X - 0.5, 0.2, -112)) },
  // SUMMER. The old ladies' gardens in July, round a sunflower
  { name: 'garden', setup(){ world({ S: 2.32, tod: 0.42, fov: 45 }); },
    cam: u => { const c = V(-0.4, 1.55, -103); return look(orbit(c, 3.1, mix(0.6, 1.05, ease(u)), 1.5), c.clone().add(V(-1.5, 0.1, -1.5))); } },
  // the cat dozing on a limb of the chestnut
  { name: 'cat', warm: 30, setup(){ world({ S: 2.4, tod: 0.5, fov: 40 }); const C = T.cat; C.force = 'tree'; C.timer = 0; T.updateCat(0.01, 0); for (let i = 0; i < 900; i++) T.updateCat(0.05, i * 0.05); this.c = C.root.position.clone(); },
    cam(u){ const c = this.c.clone(); c.y += 0.15; const a = Math.atan2(c.x - T.TREE.x, c.z - T.TREE.z); return look(orbit(c, 1.75, a + mix(0.5, 0.75, ease(u)), c.y + 0.55), c); } },
  // a summer evening, lying under the tree
  { name: 'lie', setup(){ world({ S: 2.25, tod: 0.95, fov: 62 }); },
    cam: u => [V(T.TREE.x - 3.2, 0.35, T.TREE.z + 3.5), mix(0.15, 0.45, u), 1.0] },
  // AUTUMN. October: the tree gone gold, the leaves coming down
  { name: 'autumn', warm: 150, setup(){ world({ S: 3.36, tod: 0.45 }); },
    cam: u => look(vmix(V(2.3, 1.75, -128.3), V(3.9, 1.75, -130.2), ease(u)), V(T.TREE.x, mix(6.5, 7.5, u), T.TREE.z)) },
  // roasting chestnuts at dusk
  { name: 'fire', setup(){ world({ S: 3.42, tod: 0.79 }); const F = T.fire; T.nutsHeld = 12; F.on = F.lit = true; F.t = 20; F.flameK = 1; F.emberK = 1; F.roastT = 999; for (let i = 0; i < 200; i++) T.updateFire(1 / 30, i / 30, 0); },
    cam: u => { const a = mix(-0.5, -0.25, ease(u)); return look(orbit(T.FIRE, 2.6, a, 0.85), V(T.FIRE.x, 0.45, T.FIRE.z)); } },
  // WINTER. Dusk, snowing, a snowman
  { name: 'winter', warm: 90, setup(){ world({ S: 0.42, tod: 0.69, weather: 'rain' });
      if (!this.sm){ this.sm = T.makeSnowman(V(1.8, 0, -140.5), 0.55); } this.sm.g.visible = true; this.sm.build = 1; this.sm.melt = 0; },
    cam: u => look(vmix(V(-1.2, 1.3, -134.2), V(-0.1, 1.35, -135.3), ease(u)), V(2.2, 1.5, -141.5)) },
  // my room on a winter night: the lamp, the calculator, the bather
  { name: 'room', setup(){ world({ S: 0.45, tod: 0.9, fov: 45 }); near(0.02); T.calc.on = true; T.calc.update && T.calc.update(); },
    cam: u => look(vmix(V(5.3, 8.52, -151.4), V(5.05, 8.35, -151.75), ease(u)), V(4.65, 8.0, -151.95)) },
  // Dad's chess set playing Fischer–Spassky, a winter afternoon
  { name: 'chess', warm: 150, setup(){ world({ S: 0.5, tod: 0.55, fov: 42 }); near(0.02); T.CHESS.reset(); if (!A()) for (let i = 0; i < 3; i++) T.CHESS.tap(); },
    cam: u => { const c = T.desk.views.chess.t; return look(orbit(c, 0.62, mix(1.9, 2.35, ease(u)), c.y + 0.22), c.clone().add(V(0, 0.02, 0))); } },
  // THE TOWN. Out on the Orlyonok, along Stabu
  { name: 'bike', warm: 60, async setup(){ world({ S: 2.0, tod: 0.62, mode: 'walk' }); T.BIKE.mount(); await new Promise(r => setTimeout(r, 1100));
      const st = T.BIKE.st; st.x = 2; st.z = -41; st.head = T.cam.yaw = Math.PI / 2; st.v = 3.5; T.cam.pitch = -0.28; T.keys.add('KeyW'); if (A()) setTimeout(() => T.BIKE.bell(), 1500); },
    cam: null },
  // St. Gertrude's at the end of the cobbled street behind ours
  // (from the portal up the tower to the cross, 65 m up, backing down the street until the whole of it is in the frame;
  // the tower's front is at x = -145, the spire over its middle at -149.5)
  { name: 'church', setup(){ world({ S: 2.85, tod: 0.76, fov: 54 }); },
    cam: u => tiltUp({ from: V(-103, 1.7, -216.6), to: V(-90, 1.7, -216.8), yawAt: V(-149.5, 0, -217), base: V(-145, 0, -217),
      top: V(-149.5, 66.5, -217), low: 7 }, u),
    acam: () => [V(T.SYN.x1 + 8, 1.7, T.SYN.cz), 0, 0] },
  // the Great Choral Synagogue
  { name: 'synagogue', setup(){ world({ S: 1.9, tod: 0.42 }); },
    // (from its doors up to the star on its middle gable, ~25 m up; its front, to the east, is at x = 21.4)
    cam: u => tiltUp({ from: V(46, 1.7, 150), to: V(44.5, 1.7, 154.5), yawAt: V(T.SYN.cx + 6, 0, T.SYN.cz), base: V(21.4, 0, T.SYN.cz),
      top: V(21.4, 25.5, T.SYN.cz), low: 3.5 }, u),
    acam: () => [V(T.SYN.x1 + 4, 1.7, T.SYN.cz), 0, 0] },
  // up on the roof of the tall house across Stabu
  { name: 'roof', setup(){ world({ S: 2.85, tod: 0.74, fov: 36 }); this.E = T.tallHouse(); },
    cam(u){ const E = this.E, p = T.toWorld(E, mix(-3, 2, ease(u)), 1.2); p.y = T.roofTop(E, 1.2) + 1.6; return look(p, V(T.TREE.x, 6, T.TREE.z)); },
    acam: u => [u < 0.3 ? V(T.SYN.x1 + 6, 1.7, T.SYN.cz) : V(T.TREE.x - 8, 1.7, T.TREE.z + 8), 0, 0] },
  // FINALE. The year turning round the tree, coming to rest in May
  { name: 'year', setup(){ world({ S: 1.9, tod: 0.5, fov: 45 }); this.cleared = false; },
    cam(u){ if (!A()){ T.S = (1.9 + 3.76 * ease(Math.min(1, u / 0.6))) % 4; T.sTarget = null; if (!this.cleared && T.S > 0.85 && T.S < 1.2){ this.cleared = true; for (const L of T.FLs) L.on = false; } } else T.S = 1.66;
      return look(V(-13, 5.2, -108), V(9, 6.5, -140)); } },
];
window.SHOT_BEGIN = async i => { const s = SHOTS[i]; await s.setup(); window.__camLock = A() && s.acam ? () => s.acam(U.u, U.f) : s.cam ? () => s.cam(U.u, U.f) : null; };
window.SHOT_END = () => { T.keys.clear(); if (T.BIKE.st.riding){ T.BIKE.dismount(false); } T.mode = 'free'; near(0.1); };
