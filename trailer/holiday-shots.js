// The holiday promo's shots (make_holiday.py), run after shots.js, whose helpers they use (V, look, vmix, ease, mix, world, near, A).
// The cut is counted in bars of its music (music.mjs: Jingle Bells at 144 a minute, so a bar is 5/3 s, 50 frames at 30 fps):
// two bars of intro, the verse's eight while the snowmen go up, the chorus's sixteen for the ride, four for the end card.
// Each shot's plan entry (SHOT_BEGIN's second argument) says on which bar it starts (bar0) and how far ahead of it, for a dissolve (lead),
// so a shot always knows where it is in the music, and the ride goes on across the cuts as one ride.
var HB = 60 / 144 * 4, HBEAT = HB / 4, CHORUS = 10;   // a bar and a beat, in seconds; the chorus (the ride) starts on bar 10
var HOL = window.HOL || (window.HOL = {}), CUR = { bar0: 0, lead: 0, dur: 1 };
var gt = u => CUR.bar0 * HB - (CUR.lead || 0) + u * CUR.dur;   // the time in the music at u
var st_ = u => gt(u) - CUR.bar0 * HB;                          // seconds since the shot's own bar
var clampV = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------------------------------------------------------------- the snowmen
// the yard: three in a row before the house to weave through, the rest about the yard; the lane: eight down its middle, 6.5 m apart,
// the first by the yard. [x, z, the way it faces]: 0 faces south, down the lane towards Stabu and the sun
var SPOTS = { S1: [6.5, -142, 0.15], S2: [1.5, -142, -0.2], S3: [-3.5, -142, 0.25],
  D1: [15.2, -143.8, -0.5], D2: [-12.3, -140.5, 0.6], D3: [-1.2, -134.2, 0.3], D4: [4.2, -134.8, -0.25], D5: [-14.6, -145.6, 0.45] };
for (let k = 0; k < 8; k++) SPOTS['L' + (k + 1)] = [-8.5, -122 + 6.5 * k, (k % 2 ? -0.22 : 0.22)];
var YARD = ['S1', 'S2', 'S3', 'D1', 'D2', 'D3', 'D4', 'D5'], LANE = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'];
function men(){ if (HOL.men) return HOL.men;
  const r0 = Math.random; let s = 1984; Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;   // (the same snowmen every run)
  HOL.men = {}; for (const [k, [x, z, yaw]] of Object.entries(SPOTS)){ const sm = T.makeSnowman(V(x, 0, z), yaw); T.SNOWMEN.splice(T.SNOWMEN.indexOf(sm), 1); sm.g.visible = false; sm.posed = -1; sm.rx0 = sm.balls[0].rotation.x; HOL.men[k] = sm; }
  Math.random = r0; return HOL.men; }
// a snowman as far built as b (0 nothing, 1 done), by the game's own snowman code; its crunch, as the game makes it, in the sound pass
function poseMan(sm, b){ b = clampV(b, 0, 1); sm.g.visible = b > 0;
  if (A() && Math.floor(b * 18) !== Math.floor(Math.max(0, sm.posed) * 18) && b > sm.posed && b < 1) T.sfx.crunch();
  if (!sm.g.visible || sm.posed === b) { sm.posed = b; return; }
  const SM = T.SNOWMEN, keep = SM.splice(0); SM.push(sm); sm.build = b; sm.melt = 0; T.updateSnowmen(0, 0); SM.length = 0; SM.push(...keep);
  sm.balls[0].rotation.x = sm.rx0 - 7 * Math.min(1, b / 0.3);   // (the base rolled into place)
  sm.posed = b; }
// the snowmen for a shot: `have` all there, `builds` {name: [from, seconds]} going up as the shot goes (seconds since its bar), the rest not yet
function snowmen(have, builds = {}, t = 0){ const M = men();
  for (const k in M) poseMan(M[k], builds[k] ? (t - builds[k][0]) / builds[k][1] : have.includes(k) ? 1 : 0); }

// ---------------------------------------------------------------- the ride
// one ride, from the east side of the yard round the north of the chestnut, west along the house weaving the three, left into the lane
// and down it between the eight, a snowman passed on every bar of the chorus's second half, and on towards Stabu.
// A natural cubic spline through the points (so the curvature, and with it the steering and the lean, never jumps), timed so the rider
// is level with each lane snowman on its bar.
var RIDE_PTS = (() => { const P = [[15.6, -127.5], [15.6, -133], [15.1, -137.6], [13.2, -140.9], [10, -142.4], [6.5, -140.75], [4, -141.6],
    [1.5, -143.3], [-1, -142.2], [-3.5, -140.75], [-6.4, -138.8], [-8.4, -135.3], [-8.9, -130.5], [-8.5, -126.5]];
  const A = 1.3; for (let k = 0; k < 8; k++){ const z = -122 + 6.5 * k; P.push([-8.5 + (k % 2 ? -A : A), z]); P.push([-8.5, z + 3.25]); }
  P.push([-8.5 - 0.6, -68.5], [-8.6, -63], [-8.6, -57]); return P; })();
// keys of the ride: [ride time, the lane snowman to be level with then]; the ride's own clock starts with the chorus
var RIDE_KEYS = LANE.map((k, i) => [(8 + i) * HB, i]);
function natSpline(t, y){ const n = t.length, a = new Float64Array(n), b = new Float64Array(n), c = new Float64Array(n), r = new Float64Array(n), m = new Float64Array(n);
  for (let i = 1; i < n - 1; i++){ a[i] = t[i] - t[i - 1]; b[i] = 2 * (t[i + 1] - t[i - 1]); c[i] = t[i + 1] - t[i]; r[i] = 6 * ((y[i + 1] - y[i]) / c[i] - (y[i] - y[i - 1]) / a[i]); }
  for (let i = 2; i < n - 1; i++){ const w = a[i] / b[i - 1]; b[i] -= w * c[i - 1]; r[i] -= w * r[i - 1]; }
  for (let i = n - 2; i >= 1; i--) m[i] = (r[i] - c[i] * m[i + 1]) / b[i];
  return x => { let i = 1; while (i < n - 1 && x > t[i]) i++; const h = t[i] - t[i - 1], A_ = (t[i] - x) / h, B_ = (x - t[i - 1]) / h;
    return A_ * y[i - 1] + B_ * y[i] + ((A_ ** 3 - A_) * m[i - 1] + (B_ ** 3 - B_) * m[i]) * h * h / 6; }; }
// monotone cubic through (x, y) keys (Fritsch-Carlson): the distance ridden against time
function monotone(xs, ys){ const n = xs.length, d = [], s = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  s[0] = d[0]; s[n - 1] = d[n - 2]; for (let i = 1; i < n - 1; i++) s[i] = d[i - 1] * d[i] <= 0 ? 0 : 2 / (1 / d[i - 1] + 1 / d[i]);
  return x => { if (x <= xs[0]) return ys[0] + s[0] * (x - xs[0]); if (x >= xs[n - 1]) return ys[n - 1] + s[n - 1] * (x - xs[n - 1]);
    let i = 0; while (x > xs[i + 1]) i++; const h = xs[i + 1] - xs[i], q = (x - xs[i]) / h, q2 = q * q, q3 = q2 * q;
    return (2 * q3 - 3 * q2 + 1) * ys[i] + (q3 - 2 * q2 + q) * h * s[i] + (-2 * q3 + 3 * q2) * ys[i + 1] + (q3 - q2) * h * s[i + 1]; }; }
function ride(){ if (HOL.ride) return HOL.ride;
  const P = RIDE_PTS, c = [0]; for (let i = 1; i < P.length; i++) c.push(c[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const fx = natSpline(c, P.map(p => p[0])), fz = natSpline(c, P.map(p => p[1]));
  // the path every 2 cm: arc length, heading, its change per metre
  const N = Math.ceil(c[c.length - 1] / 0.02), X = [], Z = [], S = [0], H = [];
  for (let i = 0; i <= N; i++){ const q = c[c.length - 1] * i / N; X.push(fx(q)); Z.push(fz(q)); if (i) S.push(S[i - 1] + Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1])); }
  for (let i = 0; i <= N; i++){ const j = Math.min(N, i + 1), k = Math.max(0, i - 1); H.push(Math.atan2(-(X[j] - X[k]), -(Z[j] - Z[k]))); }
  for (let i = 1; i <= N; i++){ while (H[i] - H[i - 1] > Math.PI) H[i] -= 2 * Math.PI; while (H[i] - H[i - 1] < -Math.PI) H[i] += 2 * Math.PI; }
  const sAt = q => { let lo = 0, hi = N; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (S[m] < q) lo = m; else hi = m; } const k = (q - S[lo]) / ((S[hi] - S[lo]) || 1); return [lo, k]; };
  const at = (arr, q) => { const [i, k] = sAt(q); return arr[i] + (arr[Math.min(N, i + 1)] - arr[i]) * k; };
  // where along it each lane snowman is passed: the nearest point to the apex beside it
  const apex = LANE.map((_, k) => { const z = -122 + 6.5 * k, x = -8.5 + (k % 2 ? -1.3 : 1.3); let best = 0, bd = 1e9; for (let i = 0; i <= N; i++){ const d = Math.hypot(X[i] - x, Z[i] - z); if (d < bd){ bd = d; best = i; } } return S[best]; });
  const tk = RIDE_KEYS.map(k => k[0]), sk = RIDE_KEYS.map(k => apex[k[1]]);
  const sOfT = monotone([0, ...tk], [0, ...sk]);
  // sampled at 120 a second: where, which way, how fast, the steering, the lean (balanced for the turn: tan lean = v^2 k / g, looked at
  // a little ahead and behind so it leans into a turn as it comes, not after), the cranks (pedalling, coasting through the tighter turns)
  const DT = 1 / 120, M = Math.ceil(32 / DT), R = { t: [], x: [], z: [], h: [], v: [], steer: [], lean: [], crank: [], coast: [], s: [] };
  let crank = 0, sp = 0;
  for (let i = 0; i <= M; i++){ const t = i * DT, s = Math.min(S[N], sOfT(t)), v = Math.max(0, (sOfT(t + DT) - sOfT(t - DT)) / (2 * DT));
    const k = (at(H, Math.min(S[N], s + 0.05)) - at(H, Math.max(0, s - 0.05))) / 0.1;
    const coast = Math.abs(k) > 0.16;
    if (!coast) crank -= (s - sp) / 0.6996; sp = s;
    R.t.push(t); R.s.push(s); R.x.push(at(X, s)); R.z.push(at(Z, s)); R.h.push(at(H, s)); R.v.push(v); R.steer.push(Math.atan(0.9987 * k)); R.lean.push(-Math.atan(v * v * k / 9.8)); R.crank.push(crank); R.coast.push(coast ? 1 : 0); }
  const sm = (a, w) => a.map((_, i) => { let s = 0, n = 0; for (let j = -w; j <= w; j++){ const q = a[Math.max(0, Math.min(M, i + j))]; s += q; n++; } return s / n; });
  R.lean = sm(sm(R.lean, 18), 18).map(l => clampV(l, -0.5, 0.5)); R.steer = sm(R.steer, 10);
  R.get = t => { const f = clampV(t / DT, 0, M - 1), i = Math.floor(f), k = f - i, g = a => a[i] + (a[i + 1] - a[i]) * k;
    return { t, s: g(R.s), x: g(R.x), z: g(R.z), head: g(R.h), v: g(R.v), steer: g(R.steer), lean: g(R.lean), crank: g(R.crank), coast: R.coast[i] }; };
  R.len = S[N]; return HOL.ride = R; }
var rt = u => gt(u) - CHORUS * HB;   // the ride's own clock at u

// ---------------------------------------------------------------- the bike
// on it (at once: no fade) or off it (it goes back to the wall by our door)
function onBike(on){ const B = T.BIKE;
  if (on && !B.riding){ const f = T.fadeThen; T.fadeThen = fn => fn(); T.mode = 'walk'; B.mount(); T.fadeThen = f; T.mode = 'free'; }
  else if (!on && B.riding) B.dismount(false);
  if (on && !HOL.wheels){   // (the wheels: what turns when it rolls)
    const st = B.st, keep = { ...st }, objs = []; B.root.traverse(o => objs.push([o, o.rotation.z]));
    Object.assign(st, { x: -8.5, z: -100, head: Math.PI, v: 3, steer: 0, lean: 0 }); window.__bs = 0; B.step(0.1, 0, 0);
    HOL.wheels = objs.filter(([o, z]) => Math.abs((o.rotation.z - z) + 3 / 0.2915 * 0.1) < 0.05).map(([o, z]) => (o.rotation.z = z, o));
    Object.assign(st, keep);
    B.root.traverse(o => { if (o.isGroup && o.children.length === 5 && o.children.every(c => c.isMesh && c.material && c.material.colorWrite === false)) o.userData.hat = true; }); } }
// the rider seen from outside: his head and his fur hat drawn (in the game they only cast a shadow, so they never get in the eye's way)
function riderSeen(on){ const THREE = T.THREE;
  const skin = HOL.skin || (HOL.skin = new THREE.MeshStandardMaterial({ color: '#e0aa88', roughness: 0.62 })), fur = HOL.fur || (HOL.fur = new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 1 }));
  T.BIKE.root.traverse(o => { if (!o.isMesh) return; if (o.userData.ghost === undefined && o.material && o.material.colorWrite === false) o.userData.ghost = o.material;
    if (o.userData.ghost){ let hat = false; for (let p = o.parent; p; p = p.parent) if (p.userData.hat) hat = true; o.material = on ? (hat ? fur : skin) : o.userData.ghost; } }); }
// the bike and its rider where the ride has them at ride time t; the eye left where the rider's is (for the shots seen through it)
function rideTo(t){ const R = ride().get(t), st = T.BIKE.st;
  Object.assign(st, { x: R.x, z: R.z, head: R.head, v: R.v, steer: R.steer, lean: R.lean, crank: R.crank, ky: 0, bump: 0 }); window.__bs = 0; T.cam.yaw = R.head;
  T.BIKE.step(0, 0, 0); for (const w of HOL.wheels || []) w.rotation.z = -R.s / 0.2915;
  if (A()){ // (the sound pass: the freewheel ticking while it coasts, as the game ticks it)
    if (HOL.tickT != null && R.coast && R.v > 0.6){ HOL.tick = (HOL.tick || 0) + Math.max(0, t - HOL.tickT) * R.v * 9; while (HOL.tick > 1){ HOL.tick -= 1; T.sfx.tick(Math.min(1, R.v / 4)); } }
    HOL.tickT = t; }
  return R; }
// the bell, rung at ride time `at` (once, in the sound pass)
function bellAt(t, at){ HOL.rung = HOL.rung || {}; if (A() && t >= at && t < at + 0.5 && !HOL.rung[at]){ HOL.rung[at] = 1; T.BIKE.bell(); } }
// the camera rolled with the bike (the camera lock sets no roll: put it in as the lock sets the rotation)
function withRoll(r){ const R = T.camera.rotation, set = R.set; R.set = function (x, y, z, o){ R.set = set; return set.call(this, x, y, r, o); }; }
// the ride as seen from the saddle: the eye where the game puts it, turned `dy` from straight ahead, pitched `p`, leaning with the bike
function pov(t, dy = 0, p = -0.22){ const R = rideTo(t); withRoll(T.BIKE.roll * 0.5); return [T.camera.position.clone(), R.head + dy, p]; }
function riderPos(t){ const R = ride().get(t); return V(R.x, 0, R.z); }

// ---------------------------------------------------------------- running, seen through my eyes
// keys [t, x, z]: eased from one to the next (so it starts and stops); the eye bobs with the stride, a step heard in the snow each time
function run(keys, t){ let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++; const [t0, x0, z0] = keys[i], [t1, x1, z1] = keys[i + 1], k = ease(clampV((t - t0) / (t1 - t0), 0, 1));
  const p = V(mix(x0, x1, k), 1.55, mix(z0, z1, k)), d = HOL.runD = (HOL.runT != null && t > HOL.runT ? (HOL.runD || 0) + Math.hypot(p.x - HOL.runP.x, p.z - HOL.runP.z) : HOL.runD || 0);
  if (A() && HOL.runP && Math.floor(d / 0.85) !== Math.floor((d - Math.hypot(p.x - HOL.runP.x, p.z - HOL.runP.z)) / 0.85)) T.sfx.step('ground', 1.4);
  HOL.runP = p.clone(); HOL.runT = t; p.y += Math.abs(Math.sin(d / 0.85 * Math.PI)) * 0.06 - 0.03; return [p, d]; }

// ---------------------------------------------------------------- the shots
var DAY = { S: 0.42, tod: 0.46 }, NOON = { S: 0.42, tod: 0.52 };
var HSHOTS = [
  // INTRO (2 bars). A winter morning: my window swinging open onto the snowy yard
  { name: 'h-window', setup(){ world({ S: 0.42, tod: 0.45, fov: 58, lamp: false, mode: 'window' });
      if (!HOL.warm){ HOL.warm = 1; onBike(true); onBike(false); }   // (on and off the bike once now: the first time the game builds his hands, which would make the ride's first shot start late in the sound pass)
      near(0.03); snowmen([]); this.opened = false; },
    cam(u){ if (!this.opened && st_(u) > 0.3){ this.opened = true; T.winOpen.target = 1; }
      return look(vmix(V(5.15, 8.85, -152.6), V(5.3, 8.75, -150.35), ease(u)), vmix(V(7.5, 7.5, -138), V(6.5, 3.2, -136), ease(u))); } },
  // VERSE (8 bars). Out of the door and running: a snowman up on each bar I stop on
  { name: 'h-run', setup(){ world({ ...DAY, fov: 66 }); near(0.05); onBike(false); HOL.runT = null; HOL.runD = 0; HOL.runP = null; },
    cam(u){ const t = st_(u);
      snowmen([], { D3: [HB + 0.1, 1.3], D2: [3 * HB + 0.1, 1.3] }, t);
      const [p, d] = run([[0, 8.6, -146.8], [1.45, 1.1, -136.3], [3.3, 1.0, -136.4], [4.85, -9.6, -139.5], [6.7, -9.7, -139.6]], t);
      // looking where I run, then down at the snowman as it goes up, then round to the next
      const tgt = t < 1.2 ? vmix(V(-1, 1.2, -133), V(-1.2, 0.5, -134.2), clampV(t / 1.2, 0, 1)) : t < 3.2 ? V(-1.2, mix(0.45, 1.0, ease(clampV((t - 1.8) / 1.2, 0, 1))), -134.2)
        : t < 4.6 ? vmix(V(-1.2, 1.0, -134.2), V(-12.3, 0.5, -140.5), ease(clampV((t - 3.2) / 0.9, 0, 1))) : V(-12.3, mix(0.45, 1.0, ease(clampV((t - 5.1) / 1.2, 0, 1))), -140.5);
      const L = look(p, tgt); withRoll(Math.sin(d / 0.85 * Math.PI) * 0.012); return L; } },
  // the rest of the yard's snowmen going up, one on each beat, seen from high over the end of the lane
  { name: 'h-yard', setup(){ world({ ...DAY, fov: 50 }); onBike(false); },
    cam(u){ const t = st_(u), B = {}; ['D4', 'S3', 'D5', 'S2', 'D1', 'S1'].forEach((k, i) => B[k] = [i * HBEAT + 0.05, 0.75]);
      snowmen(['D2', 'D3'], B, t);
      return look(vmix(V(-11.5, 5.6, -126), V(-10.2, 4.9, -127.5), ease(u)), V(2.5, 0.6, -140)); } },
  // and down the gravel lane, one on each beat
  { name: 'h-lane', setup(){ world({ ...DAY, fov: 48 }); onBike(false); },
    cam(u){ const t = st_(u), B = {}; LANE.forEach((k, i) => B[k] = [i * HBEAT + 0.05, 0.7]);
      snowmen(YARD, B, t);
      return look(vmix(V(-11, 1.7, -131), V(-10.9, 1.9, -116), ease(u)), V(-8.6, 0.6, mix(-108, -90, ease(u)))); } },
  // CHORUS (16 bars): the ride. "Jingle bells": round the chestnut, the bell rung
  { name: 'h-go', setup(){ world({ ...NOON, fov: 46 }); onBike(true); riderSeen(true); snowmen([...YARD, ...LANE]); },
    // (from by the workshops' wall, north of the chestnut: he comes up the east side of the yard towards it and swings round in front)
    cam(u){ const t = rt(u), R = rideTo(t); bellAt(t, 0.15);
      return look(vmix(V(17.1, 0.8, -141.6), V(17.0, 0.95, -142.2), ease(u)), V(mix(R.x, 15.2, 0.25), 0.85, R.z)); } },
  // through my eyes: along the house, the three ahead
  { name: 'h-pov1', setup(){ world({ ...NOON, fov: 72 }); near(0.04); onBike(true); riderSeen(false); snowmen([...YARD, ...LANE]); },
    cam(u){ const t = rt(u); return pov(t, 0, -0.22); } },
  // weaving the three, from before them, the house behind
  { name: 'h-weave', setup(){ world({ ...NOON, fov: 34 }); onBike(true); riderSeen(true); snowmen([...YARD, ...LANE]); },
    cam(u){ const t = rt(u), R = rideTo(t); return look(V(-6.5, 1.15, -133.5), V(R.x, 0.9, R.z)); } },
  // from high, left into the lane; "hey!": the bell
  { name: 'h-turn', setup(){ world({ ...NOON, fov: 46 }); onBike(true); riderSeen(true); snowmen([...YARD, ...LANE]); },
    cam(u){ const t = rt(u), R = rideTo(t); bellAt(t, 7 * HB + 2 * HBEAT);
      return look(vmix(V(-5.4, 2.2, -142.8), V(-6.8, 6.5, -138.8), ease(u)), vmix(V(R.x, 0.7, R.z), V(-8.5, 0.4, -112), clampV(u * 1.15 - 0.15, 0, 1) ** 1.5)); } },
  // the slalom, a snowman passed on every bar: from in front, a long lens, the snowmen stacked up behind him
  { name: 'h-front', setup(){ world({ ...NOON, fov: 30 }); onBike(true); riderSeen(true); snowmen([...YARD, ...LANE]); },
    cam(u){ const t = rt(u), R = rideTo(t); return look(V(-5.35, 1.25, R.z + 9), V(R.x * 0.6 - 8.5 * 0.4, 0.85, R.z)); } },   // (along the garden fence, a little ahead, as a slalom is filmed from the side of the course)
  // through my eyes between them
  { name: 'h-pov2', setup(){ world({ ...NOON, fov: 72 }); near(0.04); onBike(true); riderSeen(false); snowmen([...YARD, ...LANE]); },
    cam(u){ const t = rt(u); return pov(t, 0, -0.2); } },
  // from straight above, the weave drawn round them
  { name: 'h-above', setup(){ world({ ...NOON, fov: 45 }); onBike(true); riderSeen(true); snowmen([...YARD, ...LANE]); },
    cam(u){ const t = rt(u), R = rideTo(t); return [V(-8.5, 13, R.z - 3.4), Math.PI + mix(-0.12, 0.12, u), -1.3]; } },
  // after him, low, the last two and on towards Stabu and the sun; the bell again on "sleigh"
  { name: 'h-after', setup(){ world({ ...NOON, fov: 40 }); onBike(true); riderSeen(true); snowmen([...YARD, ...LANE]); },
    cam(u){ const t = rt(u), R = rideTo(t); bellAt(t, 15 * HB + 0.05);
      return look(V(-10.6, 1.05, R.z - 5.5), V(R.x * 0.5 - 8.5 * 0.5, 0.9, R.z + 6)); } },
  // OUTRO (4 bars). Dusk: the yard full of snowmen, the windows lit, snowing. Happy Holidays
  { name: 'h-dusk', warm: 90, setup(){ world({ S: 0.42, tod: 0.705, fov: 48, weather: 'rain' }); onBike(false); snowmen([...YARD, ...LANE]); },
    cam: u => look(vmix(V(-6.6, 1.55, -128.6), V(-7.6, 3.2, -126.4), ease(u)), vmix(V(4, 1.4, -142), V(4, 2.4, -142), ease(u))) },
];
SHOTS = SHOTS.concat(HSHOTS);
window.SHOT_BEGIN = async (i, s) => { if (s) CUR = s; const sh = SHOTS[i]; await sh.setup(); window.__camLock = A() && sh.acam ? () => sh.acam(U.u, U.f) : sh.cam ? () => sh.cam(U.u, U.f) : null; };
window.SHOT_END = () => { T.keys.clear(); T.mode = 'free'; near(0.1); };   // (the bike stays mounted from one shot of the ride to the next)
