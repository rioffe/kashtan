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
function onBike(on){ const B = T.BIKE, cam = T.camera, fov = cam.fov, nr = cam.near;
  if (on && !B.riding){ const f = T.fadeThen; T.fadeThen = fn => fn(); T.mode = 'walk'; B.mount(); T.fadeThen = f; T.mode = 'free'; }
  else if (!on && B.riding) B.dismount(false);
  cam.fov = fov; cam.near = nr; cam.updateProjectionMatrix();   // (the shot's own lens: getting on puts the game's riding lens on the camera, getting off the one before)
  if (on && !HOL.wheels){   // (the wheels: what turns when it rolls)
    const st = B.st, keep = { ...st }, objs = []; B.root.traverse(o => objs.push([o, o.rotation.z]));
    Object.assign(st, { x: -8.5, z: -100, head: Math.PI, v: 3, steer: 0, lean: 0 }); window.__bs = 0; B.step(0.1, 0, 0);
    HOL.wheels = objs.filter(([o, z]) => Math.abs((o.rotation.z - z) + 3 / 0.2915 * 0.1) < 0.05).map(([o, z]) => (o.rotation.z = z, o));
    Object.assign(st, keep);
    B.root.traverse(o => { if (o.isGroup && o.children.length === 5 && o.children.every(c => c.isMesh && c.material && c.material.colorWrite === false)) o.userData.hat = true; }); } }
// the rider seen from outside: a face and a fur hat on his head (in the game the head is only a shadow, an egg with a nose and a hat of
// boxes, so it never gets in the eye's way; that goes on casting the shadow, the face and the hat drawn where it is)
function riderSeen(on){ let hatG = null; T.BIKE.root.traverse(o => { if (o.userData.hat) hatG = o; });
  const F = face(); if (hatG && F.parent !== hatG.parent) hatG.parent.add(F); F.visible = on; }

// ---------------------------------------------------------------- my face
// A twelve-year-old's head, in the head's own frame (x forward, y up, z across; the eye the game sees through at x 0.058, y -0.018):
// one smooth surface, a signed distance field (the skull, the face, the jaw and chin, the cheeks, the brow, the nose, the lips, the ears,
// the neck; the eyes' openings and the nostrils cut into it) meshed by surface nets, as the game meshes the torso, and coloured in its
// vertices: the cheeks and the nose red with the cold, the lips, the brows, the lashes, the black hair showing under the hat. The eyes are
// balls of their own, glossy, so they catch the light, the lids round them; my glasses over them. The hat, an ushanka with its ear flaps tied up over the top, the
// same way, in fur.
var smin_ = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }, smax_ = (a, b, k) => -smin_(-a, -b, k);
var ell_ = (x, y, z, cx, cy, cz, rx, ry, rz) => { const X = (x - cx) / rx, Y = (y - cy) / ry, Z = (z - cz) / rz, k0 = Math.hypot(X, Y, Z), k1 = Math.hypot(X / rx, Y / ry, Z / rz); return k1 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz); };
var cap_ = (x, y, z, ax, ay, az, bx, by, bz, r0, r1) => { const abx = bx - ax, aby = by - ay, abz = bz - az, px = x - ax, py = y - ay, pz = z - az, t = clampV((px * abx + py * aby + pz * abz) / (abx * abx + aby * aby + abz * abz), 0, 1);
  return Math.hypot(px - abx * t, py - aby * t, pz - abz * t) - (r0 + (r1 - r0) * t); };
var rbox_ = (qx, qy, qz, bx, by, bz, r) => { const dx = Math.abs(qx) - bx + r, dy = Math.abs(qy) - by + r, dz = Math.abs(qz) - bz + r;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dy, dz), 0) - r; };
var sstep_ = (a, b, x) => { const t = clampV((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
var FACE = { eye: [0.0705, -0.0215, 0.0302], eyeR: 0.0118,
  mouthY: z => -0.0697 + 0.004 * (z / 0.02) ** 2, mouthX: z => 0.0915 - 32 * z * z };   // (the mouth a little smile, round the face)
FACE.ear = (x, y, az) => ell_(x, y, az, -0.006, -0.025, 0.067, 0.0125, 0.026, 0.0075);
FACE.socket = (x, y, az) => ell_(x, y, az, 0.0795, -0.022, 0.0302, 0.0095, 0.0049, 0.0132);
FACE.mouth = (x, y, z) => { const zc = clampV(z, -0.02, 0.02); return Math.hypot(x - FACE.mouthX(zc), y - FACE.mouthY(zc), z - zc); };
FACE.lips = (x, y, z) => Math.min(ell_(x, y, z, 0.0819, -0.0637, 0, 0.0071, 0.0063, 0.0205), ell_(x, y, z, 0.0795, -0.0761, 0, 0.0073, 0.0063, 0.0185));   // (full, the lower a little fuller)
FACE.sdf = (x, y, z) => { const az = Math.abs(z);
  let d = ell_(x, y, z, -0.01, 0.014, 0, 0.094, 0.098, 0.072);                                               // the skull
  d = smin_(d, ell_(x, y, z, 0.036, -0.038, 0, 0.054, 0.064, 0.053), 0.025);                                  // the face
  d = smin_(d, ell_(x, y, z, 0.06, -0.09, 0, 0.026, 0.022, 0.025), 0.018);                                    // the chin
  d = smin_(d, cap_(x, y, az, 0.058, -0.094, 0.013, 0.0, -0.074, 0.043, 0.012, 0.014), 0.02);                // the jaw, back to under the ears
  d = smin_(d, ell_(x, y, az, 0.064, -0.037, 0.034, 0.022, 0.018, 0.02), 0.014);                             // the cheeks
  d = smin_(d, cap_(x, y, z, 0.0765, -0.0045, -0.042, 0.0765, -0.0045, 0.042, 0.009, 0.009), 0.012);         // the brow
  d = smin_(d, smin_(cap_(x, y, z, 0.083, -0.017, 0, 0.097, -0.044, 0, 0.006, 0.008),                        // the nose: its bridge,
    smin_(ell_(x, y, z, 0.097, -0.047, 0, 0.0102, 0.009, 0.0098), ell_(x, y, az, 0.0885, -0.0508, 0.0104, 0.0076, 0.0064, 0.0066), 0.006), 0.006), 0.008);   // its tip, its wings
  d = smin_(d, FACE.lips(x, y, z), 0.006);                                                                    // the lips
  d = smin_(d, FACE.ear(x, y, az), 0.005);                                                                    // the ears
  d = smax_(d, -ell_(x, y, az, -0.004, -0.028, 0.0735, 0.0075, 0.0145, 0.0035), 0.0025);                     // (the hollow of each)
  d = smin_(d, cap_(x, y, z, -0.014, -0.06, 0, -0.03, -0.19, 0, 0.041, 0.044), 0.03);                        // the neck
  d = smax_(d, -ell_(x, y, az, 0.0955, -0.0562, 0.0055, 0.0034, 0.0021, 0.0029), 0.002);                      // the nostrils
  d = smax_(d, -FACE.socket(x, y, az), 0.0035);                                                               // the eyes' openings
  return d; };
// the colour at a point on it (linear RGB)
var C3_ = h => { const c = new T.THREE.Color(h); return [c.r, c.g, c.b]; }, mixc_ = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
var n3_ = (x, y, z) => Math.sin(x * 830 + Math.sin(y * 610) * 2) * Math.sin(y * 790 + z * 340) * Math.sin(z * 920 + x * 270);   // (a little unevenness)
FACE.col = (() => { const SKIN = C3_('#eebfa2'), ROSE = C3_('#e2867a'), LIP = C3_('#c25552'), MOUTH = C3_('#7a2c2a'), BROW = C3_('#15110e'), HAIR = C3_('#141110'), LASH = C3_('#2e211b'), LID = C3_('#d9a089');
  return (x, y, z) => { const az = Math.abs(z); let c = SKIN;
    c = mixc_(c, ROSE, 0.5 * Math.exp(-((x - 0.072) ** 2 + (y + 0.044) ** 2 + (az - 0.037) ** 2) / (2 * 0.012 ** 2)));   // cheeks red with the cold
    c = mixc_(c, ROSE, 0.3 * Math.exp(-((x - 0.105) ** 2 + (y + 0.048) ** 2 + z * z) / (2 * 0.008 ** 2)));             // and the nose
    if (x > 0.07 && y < -0.055 && y > -0.086) c = mixc_(c, LIP, 0.88 * sstep_(0.0024, 0.0008, FACE.lips(x, y, z)) * sstep_(0.0215, 0.0155, az) * sstep_(-0.0566, -0.0586, y));   // the lips, red (out to the blended surface over them, not up to the nose)
    c = mixc_(c, MOUTH, 0.8 * sstep_(0.0017, 0.0006, FACE.mouth(x, y, z)));                                                                  // and between them
    if (x > 0.062 && az > 0.01 && az < 0.05){ const u = (az - 0.031) / 0.018, yb = -0.0035 + 0.0038 * (1 - u * u) - 0.001 * u, th = 0.0031 - 0.001 * clampV(u, 0, 1) + 0.0004 * n3_(x, y, z);   // the brows
      c = mixc_(c, BROW, 0.92 * sstep_(th, th * 0.45, Math.abs(y - yb)) * sstep_(0.049, 0.043, az) * sstep_(0.01, 0.015, az)); }
    if (x > 0.07 && az > 0.012 && az < 0.048){ const so = FACE.socket(x, y, az);
      if (y > -0.022) c = mixc_(c, LASH, 0.9 * sstep_(0.0022, 0.0007, Math.abs(so)));                         // the lashes, along the upper lids
      else c = mixc_(c, LID, 0.45 * sstep_(0.0026, 0.0008, Math.abs(so)));                                    // (the lower lids a little pink)
      if (y > -0.022) c = mixc_(c, LID, 0.5 * sstep_(0.0016, 0, Math.abs(ell_(x, y, az, 0.0795, -0.0205, 0.0302, 0.0115, 0.0085, 0.0145)))); }   // (the fold over each eye)
    // the hair under the hat: the temples, over the ears, the back of the neck
    const hy = x > 0.06 ? 0.04 : x > 0.03 ? 0.002 : x > -0.035 ? 0.0 - 0.008 * sstep_(0.03, -0.035, x) : -0.008 - 0.048 * sstep_(-0.035, -0.07, x);
    if (FACE.ear(x, y, az) > 0.002) c = mixc_(c, HAIR, sstep_(hy - 0.002, hy + 0.003, y + 0.002 * n3_(x * 2, y, z)));
    return c; }; })();
// the hat: the crown, the fur band round the head, the front flap turned up against the crown, the ear flaps tied up over the top with
// their tapes. In the same frame; the crown's middle at (-0.008, 0.03)
var HAT = { c: [-0.008, 0.03], R: [0.103, 0.1, 0.09] };
HAT.parts = (x, y, z) => { const az = Math.abs(z), cx = x - HAT.c[0], cy = y - HAT.c[1], crown = ell_(cx, cy, z, 0, 0, 0, ...HAT.R), a = Math.atan2(az, cy), th = Math.atan2(z, cx);
  const tie = [HAT.c[0] - 0.002, HAT.c[1] + 0.1 * Math.cos(0.33) + 0.008, 0.03], top = [HAT.c[0] - 0.002, HAT.c[1] + 0.1 + 0.011, 0];
  return [smax_(crown, 0.016 - y, 0.004),                                                                    // the crown, down into the band
    Math.hypot((Math.hypot(cx / 0.101, z / 0.088) - 1) * 0.094, y - 0.031) - 0.019,                         // the band, round the head
    cx > -0.03 ? rbox_(Math.hypot(cx, z * 1.1) - (0.113 - (y - 0.03) * 0.2), y - 0.066, th * 0.11, 0.011, 0.033, 0.066, 0.009) : 1,   // the front flap, turned up
    rbox_(crown - 0.011, cx + 0.004, (a - 0.92) * 0.1, 0.0105, 0.05, 0.06, 0.009),                         // the ear flaps up the sides, over the crown
    Math.min(cap_(x, y, z, tie[0], tie[1], -tie[2], ...top, 0.0022, 0.0026), cap_(x, y, z, ...tie, ...top, 0.0022, 0.0026),   // their tapes, tied over the top
      ell_(x, y, z, top[0], top[1] + 0.001, 0, 0.006, 0.0045, 0.008))]; };
HAT.sdf = (x, y, z) => { const [c, b, f, e, t] = HAT.parts(x, y, z); return Math.min(smin_(c, b, 0.006), f, e, t); };   // (the flaps their own, so they show)
HAT.col = (() => { const DARK = C3_('#3a2c20'), FUR = C3_('#5a4533'), LIGHT = C3_('#7a6249'), TAPE = C3_('#262019');
  return (x, y, z) => { const [c, b, f, e, t] = HAT.parts(x, y, z), m = Math.min(c, b, f, e, t), fl = n3_(x * 0.5, y * 0.5, z * 0.5);
    if (t <= m + 1e-4) return TAPE;
    const base = c <= m + 1e-4 ? mixc_(DARK, FUR, 0.4 + 0.3 * fl) : mixc_(FUR, LIGHT, 0.45 + 0.4 * fl);     // (the crown darker, the band and flaps fluffier)
    const crease = Math.min(...[c, b, f, e].filter(v => v > m + 1e-4));                                   // (darker where one part meets another)
    return mixc_(base, DARK, 0.75 * sstep_(0.006, 0.0005, crease)); }; })();
// surface nets over the box [x0, x0 + sx] x ... at h a cell: positions, normals, triangles (the game's torsoGeo does the same)
function surfNets(sdf, x0, y0, z0, sx, sy, sz, h){ const NX = Math.ceil(sx / h) + 1, NY = Math.ceil(sy / h) + 1, NZ = Math.ceil(sz / h) + 1, C = 4;
  const V = new Float32Array(NX * NY * NZ), at = (i, j, k) => i + NX * (j + NY * k);
  for (let K = 0; K < NZ; K += C) for (let J = 0; J < NY; J += C) for (let I = 0; I < NX; I += C){ const dc = sdf(x0 + (I + C / 2) * h, y0 + (J + C / 2) * h, z0 + (K + C / 2) * h), far = Math.abs(dc) > h * C * 1.2;
    for (let k = K; k < Math.min(K + C, NZ); k++) for (let j = J; j < Math.min(J + C, NY); j++) for (let i = I; i < Math.min(I + C, NX); i++) V[at(i, j, k)] = far ? dc : sdf(x0 + i * h, y0 + j * h, z0 + k * h); }
  const cellV = new Int32Array((NX - 1) * (NY - 1) * (NZ - 1)).fill(-1), ci = (i, j, k) => i + (NX - 1) * (j + (NY - 1) * k), pos = [], nor = [], idx = [];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], e = h * 0.4;
  const grad = (x, y, z) => { const gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e), l = Math.hypot(gx, gy, gz) || 1; return [gx / l, gy / l, gz / l]; };
  for (let k = 0; k < NZ - 1; k++) for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++){ const v = []; let mask = 0;
    for (let c = 0; c < 8; c++){ const val = V[at(i + (c & 1), j + (c >> 1 & 1), k + (c >> 2 & 1))]; v.push(val); if (val < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue; let sx_ = 0, sy_ = 0, sz_ = 0, n = 0;
    for (const [a, b] of EDGES){ if ((v[a] < 0) === (v[b] < 0)) continue; const t = v[a] / (v[a] - v[b]); sx_ += (a & 1) + ((b & 1) - (a & 1)) * t; sy_ += (a >> 1 & 1) + ((b >> 1 & 1) - (a >> 1 & 1)) * t; sz_ += (a >> 2 & 1) + ((b >> 2 & 1) - (a >> 2 & 1)) * t; n++; }
    let x = x0 + (i + sx_ / n) * h, y = y0 + (j + sy_ / n) * h, z = z0 + (k + sz_ / n) * h; const g = grad(x, y, z), d = sdf(x, y, z); x -= g[0] * d; y -= g[1] * d; z -= g[2] * d;   // (pulled onto the surface)
    cellV[ci(i, j, k)] = pos.length / 3; pos.push(x, y, z); nor.push(...grad(x, y, z)); }
  for (let k = 1; k < NZ - 1; k++) for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++){ const inside = V[at(i, j, k)] < 0;
    for (let a = 0; a < 3; a++){ const i2 = i + (a === 0), j2 = j + (a === 1), k2 = k + (a === 2); if ((V[at(i2, j2, k2)] < 0) === inside) continue;
      const q = a === 0 ? [ci(i, j - 1, k - 1), ci(i, j, k - 1), ci(i, j, k), ci(i, j - 1, k)] : a === 1 ? [ci(i - 1, j, k - 1), ci(i, j, k - 1), ci(i, j, k), ci(i - 1, j, k)] : [ci(i - 1, j - 1, k), ci(i, j - 1, k), ci(i, j, k), ci(i - 1, j, k)];
      const vs = q.map(c => cellV[c]); if (vs.some(w => w < 0)) continue;
      for (const [a0, a1, a2] of [[vs[0], vs[1], vs[2]], [vs[0], vs[2], vs[3]]]){ const P = o => [pos[o * 3], pos[o * 3 + 1], pos[o * 3 + 2]], A = P(a0), B = P(a1), Cc = P(a2);
        const b = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], c = [Cc[0] - A[0], Cc[1] - A[1], Cc[2] - A[2]], cr = [b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0]];
        const nn = [0, 1, 2].map(m => nor[a0 * 3 + m] + nor[a1 * 3 + m] + nor[a2 * 3 + m]); if (cr[0] * nn[0] + cr[1] * nn[1] + cr[2] * nn[2] < 0) idx.push(a0, a2, a1); else idx.push(a0, a1, a2); } } }
  return { pos, nor, idx }; }
// a mesh of an SDF over a box, coloured by col(x, y, z); uv: (x, y, z) => [u, v] for a material with a picture
function sdfMesh(sdf, col, box, h, mat, uv){ const THREE = T.THREE, { pos, nor, idx } = surfNets(sdf, ...box, h), cs = [], uvs = [];
  for (let i = 0; i < pos.length; i += 3){ cs.push(...col(pos[i], pos[i + 1], pos[i + 2])); if (uv) uvs.push(...uv(pos[i], pos[i + 1], pos[i + 2])); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); if (uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(idx);
  return new THREE.Mesh(geo, mat); }
var rng_ = s => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
// the head, its eyes and its hat, built once
function face(){ if (HOL.face) return HOL.face; const THREE = T.THREE, g = new THREE.Group(), t0 = performance.now();
  g.add(sdfMesh(FACE.sdf, FACE.col, [-0.115, -0.2, -0.1, 0.245, 0.33, 0.2], 0.0019,
    new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color('#ffcab2'), sheenRoughness: 0.5 })));
  g.add(sdfMesh(HAT.sdf, HAT.col, [-0.13, -0.005, -0.125, 0.27, 0.16, 0.25], 0.0024, furMat(),
    (x, y, z) => [(Math.atan2(z, x - HAT.c[0]) / Math.PI + 1) * 5, (y + Math.hypot(x, z) * 0.3) * 30]));
  // the eyes: a ball each, the iris and pupil painted round its front pole (turned to look ahead), the white a little warm towards the back
  const eyeTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d'), H = c.height, r = s => s / 180 * H, rn = rng_(29);
    const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#f3efe9'); gr.addColorStop(0.5, '#eee4dc'); gr.addColorStop(1, '#e2c6be'); x.fillStyle = gr; x.fillRect(0, 0, c.width, H);
    x.fillStyle = '#6e5636'; x.fillRect(0, 0, c.width, r(32)); x.fillStyle = '#3a2c1e'; x.fillRect(0, r(28), c.width, r(4.5));   // the iris, hazel, its rim darker
    for (let i = 0; i < 260; i++){ const u = rn() * c.width; x.strokeStyle = rn() < 0.5 ? 'rgba(160,130,70,.55)' : 'rgba(40,30,18,.5)'; x.lineWidth = 1 + rn() * 2; x.beginPath(); x.moveTo(u, r(10)); x.lineTo(u + (rn() - 0.5) * 6, r(28)); x.stroke(); }
    x.fillStyle = '#0c0a09'; x.fillRect(0, 0, c.width, r(11.5));   // the pupil
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const eyeM = new THREE.MeshPhysicalMaterial({ map: eyeTex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 }), eyeG = new THREE.SphereGeometry(FACE.eyeR, 32, 20).rotateZ(-Math.PI / 2);   // (its pole forward)
  for (const sd of [-1, 1]){ const e = new THREE.Mesh(eyeG, eyeM); e.position.set(FACE.eye[0], FACE.eye[1], sd * FACE.eye[2]); e.rotation.set(0, sd * 0.05, -0.1); g.add(e); }   // (looking a little down, the road ahead)
  g.add(glasses());
  if (new URLSearchParams(location.search).has('bikelog')) console.log('FACE built in', (performance.now() - t0).toFixed(0), 'ms');
  return HOL.face = g; }
// my glasses: a boy's, in dark plastic, the lenses rounded ovals a little wider than tall, close in front of the eyes and following the
// face round; the bridge on the nose; the arms straight back, level, to the tops of the ears and down behind them; the lenses thin glass,
// only their shine showing
function glasses(){ const THREE = T.THREE, V3 = THREE.Vector3, g = new THREE.Group(), [ex, ey, ez] = FACE.eye;
  const frameM = new THREE.MeshStandardMaterial({ color: '#1b1613', roughness: 0.32 });
  const lensM = new THREE.MeshPhysicalMaterial({ color: '#eef4f8', transparent: true, opacity: 0.12, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false });
  const A = 0.0196, B = 0.0152, X0 = 0.0912, cz = ez + 0.0008, cy = ey + 0.0008;   // (half the lens across, half up and down; its middle: 9 mm before the eye)
  const at = (sd, th, k = 1) => { const c = Math.cos(th), s = Math.sin(th), z = sd * (cz + k * A * Math.sign(c) * Math.abs(c) ** 0.8), y = cy + k * B * Math.sign(s) * Math.abs(s) ** 0.8;
    const o = Math.abs(z) - cz; return new V3(X0 - o * 0.3 - Math.max(0, o) ** 2 * 6 + (y - cy) * 0.1, y, z); };   // (the outer side further back, round the face; the top tipped out a little)
  for (const sd of [-1, 1]){ const ring = []; for (let i = 0; i < 72; i++) ring.push(at(sd, i / 72 * Math.PI * 2));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring, true), 120, 0.0015, 8, true), frameM));
    const pos = [...at(sd, 0, 0).toArray()], idx = []; for (let i = 0; i < 72; i++){ pos.push(...at(sd, i / 72 * Math.PI * 2, 0.96).toArray()); idx.push(0, 1 + i, 1 + (i + 1) % 72); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setIndex(idx); lg.computeVertexNormals();
    const lens = new THREE.Mesh(lg, lensM); lens.renderOrder = 3; g.add(lens);
    // the arm: from the hinge at the rim's outer side, a little above the middle, straight back to the top of the ear and down behind it
    const h = at(sd, 0.3), Z = v => sd * v;
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([h, new V3(h.x - 0.006, h.y + 0.0003, Z(Math.abs(h.z) + 0.0025)), new V3(0.045, -0.011, Z(0.0635)),
      new V3(0.012, -0.0075, Z(0.0722)), new V3(-0.007, -0.0045, Z(0.0745)), new V3(-0.017, -0.014, Z(0.0722)), new V3(-0.021, -0.029, Z(0.068))]), 48, 0.0013, 6, false), frameM)); }
  const bl = at(-1, Math.PI * 0.82), br = at(1, Math.PI * 0.18);   // the bridge, between the rims' inner sides, arched over the nose and resting on it
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([bl, new V3(X0 + 0.0015, cy + 0.0065, -0.0045), new V3(X0 + 0.0015, cy + 0.0065, 0.0045), br]), 24, 0.0015, 6, false), frameM));
  return g; }
// the fur: a short pile, lighter at the tips, in a picture (multiplying the vertices' colour) and its bump
function furMat(){ if (HOL.fur) return HOL.fur; const THREE = T.THREE, S = 256;
  const pic = (bump) => { const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), r = rng_(77); x.fillStyle = bump ? '#808080' : '#d8d8d8'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 5200; i++){ const px = r() * S, py = r() * S, l = 3 + r() * 6, a = 1.2 + r() * 0.6, v = r();
      x.strokeStyle = bump ? `rgba(${v < 0.5 ? '30,30,30' : '230,230,230'},.5)` : v < 0.4 ? 'rgba(70,70,70,.5)' : v < 0.8 ? 'rgba(170,170,170,.5)' : 'rgba(255,255,255,.5)';
      x.lineWidth = 1 + r(); for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]){ x.beginPath(); x.moveTo(px + ox, py + oy); x.lineTo(px + ox + Math.cos(a) * l, py + oy + Math.sin(a) * l); x.stroke(); } }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (!bump) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return HOL.fur = new THREE.MeshStandardMaterial({ vertexColors: true, map: pic(false), bumpMap: pic(true), bumpScale: 2, roughness: 1 }); }

// the bike and its rider where the ride has them at ride time t; the eye left where the rider's is (for the shots seen through it)
function rideTo(t){ const R = ride().get(t), st = T.BIKE.st;
  Object.assign(st, { x: R.x, z: R.z, head: R.head, v: R.v, steer: R.steer, lean: R.lean, crank: R.crank, ky: T.kerbY(R.x, R.z), bump: 0 });   // (on the lane's dirt, the paths, the ring round the chestnut, as the game rides) window.__bs = 0; T.cam.yaw = R.head;
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

// ---------------------------------------------------------------- New Year trees in the windows
// A lit New Year tree in a few of our house's windows, each its own: a tall one with coloured bulbs and the red star, a bushy one in warm
// white with a gold star in a dark room, a small one on a table in blue and white with tinsel and a glass spire, another with coloured
// bulbs and tinsel in the dark. The front's windows are painted on it, so each of these is a panel laid over its window, a hair proud of
// the wall: the window drawn again as the game draws it (the glass, the yard given back in it, the curtains, the frame, from the same
// seeds) with the tree behind the glass, by day in the map and by night (the room, the tree against it, its glow) in the emissive picture,
// lit as the front's windows are lit. The bulbs are layers of their own over it, added on, in three groups that twinkle, dimmer by day.
// [bay (0-9, west to east), floor (0-2), the room behind (lit / dark, and then the tree's glow in it), the tree: its middle (across the window, 0-1), height, width, how
// high it stands (0 the floor, under the sill), its bulbs' colours, its top, glass balls, tinsel, how the garland twinkles [period, way]]
var XMAS = [
  { bay: 3, floor: 1, room: 'lit', x: 0.42, h: 2.3, w: 1.25, base: 0, bulbs: ['#ff3b30', '#ffd21f', '#3bd16f', '#2f7dff', '#ff8a1f'], top: 'star', balls: 12, tinsel: false, tw: [1.2, 'chase'], seed: 11 },
  { bay: 5, floor: 0, room: 'dark', glow: '#ffc890', x: 0.56, h: 2.2, w: 1.35, base: 0, bulbs: ['#ffd9a0', '#ffe6c0'], top: 'gold', balls: 9, tinsel: false, tw: [3.2, 'breathe'], seed: 23 },
  { bay: 8, floor: 2, room: 'lit', x: 0.64, h: 1.3, w: 0.74, base: 0.75, bulbs: ['#8fbaff', '#ffffff', '#b8d4ff'], top: 'spire', balls: 6, tinsel: true, tw: [0.45, 'random'], seed: 37 },
  { bay: 4, floor: 2, room: 'dark', glow: '#ffb27a', x: 0.38, h: 2.35, w: 1.2, base: 0, bulbs: ['#ff3b30', '#ffd21f', '#3bd16f', '#2f7dff'], top: 'star', balls: 10, tinsel: true, tw: [1.7, 'chase'], seed: 41 }];
function xmasTrees(){ if (HOL.trees) return HOL.trees; const THREE = T.THREE, PPM = 220, SILL = 0.85;   // (PPM: pixels a metre; SILL: the room's floor this far under the window)
  const group = new THREE.Group(); group.name = 'xmas'; T.scene.add(group); const layers = [];
  for (const X of XMAS){ const w = T.facadeData.find(v => !v.door && !v.stair && Math.abs(v.cx - (X.bay + 0.5) * T.BW / 10) < 0.01 && Math.abs(v.yb - (1.5 + X.floor * 3.3)) < 0.01);
    if (!w) continue; const CW = Math.round(w.w * PPM), CH = Math.round(w.h * PPM), S = v => v * PPM, K = PPM / (2048 / T.BW), r = rng_(X.seed * 7919);   // (K: the game's drawing units to ours)
    // the tree, in the window's own pixels (y down from its top): the floor SILL under the sill; tiers of drooping branches, needle by needle
    const fy = CH + S(SILL - X.base), tx = X.x * CW, th = S(X.h), tw = S(X.w), halfW = y => tw / 2 * Math.max(0, Math.min(1, (fy - y) / th < 0.06 ? (fy - y) / th / 0.06 : 1)) * Math.pow(Math.max(0, 1 - (fy - y) / th), 0.92);
    const needles = [], tiers = 7 + Math.round(X.h * 1.5);
    for (let i = 0; i < tiers; i++){ const ty = fy - th * (0.1 + 0.86 * i / tiers), hw = halfW(ty) * (1.05 + 0.1 * r());
      for (let j = 0; j < 60 + hw * 0.9; j++){ const sd = r() < 0.5 ? -1 : 1, L = hw * (0.35 + 0.65 * Math.sqrt(r())), droop = S(0.05 + 0.06 * r()) * L / Math.max(1, hw);
        for (let s = 0.15; s < 1; s += 0.09 + 0.08 * r()){ const bx = tx + sd * L * s, by = ty + droop * s * s + S(0.04) * (r() - 0.5);
          needles.push([bx, by, bx + sd * S(0.03 + 0.02 * r()) * (0.6 + r()), by + S(0.02) * (r() - 0.25), r()]); } } }
    // the garland, wound round it: the bulbs on the side towards us, in three groups
    const bulbs = [], turns = 4 + X.h * 2.2, N = Math.round(36 + X.h * 30);
    for (let i = 0; i < N; i++){ const t = (i + 0.5) / N, y = fy - th * (0.08 + 0.84 * t), a = turns * Math.PI * 2 * t + 1.3, f = Math.cos(a);
      if (f < -0.25) continue; bulbs.push({ x: tx + halfW(y) * 0.92 * Math.sin(a), y: y + S(0.02) * (r() - 0.5), c: X.bulbs[i % X.bulbs.length], g: i % 3, f: 0.55 + 0.45 * Math.max(0, f) }); }
    const balls = Array.from({ length: X.balls }, (_, i) => { const t = 0.12 + 0.72 * r(), y = fy - th * t, hw = halfW(y) * 0.8; return { x: tx + hw * (2 * r() - 1), y, rad: S(0.032 + 0.018 * r()), c: ['#c8262e', '#d9a82b', '#c9ccd2', '#2d63b8', '#8a2fa0'][(i + X.seed) % 5] }; });
    const tinsel = X.tinsel ? Array.from({ length: 170 }, () => { const y = fy - th * (0.12 + 0.78 * r()), hw = halfW(y); return [tx + hw * (2 * r() - 1) * 0.95, y, S(0.08 + 0.18 * r())]; }) : [];
    const topY = fy - th, star = (g, cx, cy, R, fill) => { g.beginPath(); for (let k = 0; k < 10; k++){ const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? R * 0.42 : R; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fillStyle = fill; g.fill(); };
    const drawTop = (g, night) => { if (X.top === 'spire'){ const gr = g.createLinearGradient(tx - S(0.02), 0, tx + S(0.02), 0); gr.addColorStop(0, night ? '#6a7080' : '#8a8f9a'); gr.addColorStop(0.5, night ? '#f0f4ff' : '#e8ecf2'); gr.addColorStop(1, night ? '#505868' : '#6b707a');
        g.fillStyle = gr; g.beginPath(); g.moveTo(tx, topY - S(0.22)); g.quadraticCurveTo(tx + S(0.03), topY - S(0.06), tx + S(0.022), topY + S(0.03)); g.lineTo(tx - S(0.022), topY + S(0.03)); g.quadraticCurveTo(tx - S(0.03), topY - S(0.06), tx, topY - S(0.22)); g.fill();
        blot(g, tx, topY - S(0.045), S(0.03), night ? '#dfe8ff' : '#c9ced8'); }
      else star(g, tx, topY - S(0.05), S(X.top === 'gold' ? 0.075 : 0.085), X.top === 'gold' ? (night ? '#ffd36a' : '#c99a2e') : (night ? '#ff2a1a' : '#b8221c')); };
    const blot = (g, x, y, rr, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); };
    const drawTree = (g, night) => {   // (by night it stands dark against the room, lit only near its bulbs)
      g.lineCap = 'round'; g.lineWidth = Math.max(1.2, S(0.008));
      g.strokeStyle = night ? '#120c08' : '#2a1f16'; g.lineWidth = S(0.03); g.beginPath(); g.moveTo(tx, fy); g.lineTo(tx, topY + S(0.05)); g.stroke(); g.lineWidth = Math.max(1.2, S(0.009));
      for (const [x0, y0, x1, y1, v] of needles){ g.strokeStyle = night ? (v < 0.5 ? '#08100a' : v < 0.85 ? '#0e1a10' : '#16281a') : (v < 0.4 ? '#14281a' : v < 0.8 ? '#1e3a25' : '#2c5233'); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
      for (const [x, y, L] of tinsel){ g.strokeStyle = night ? 'rgba(200,210,235,.32)' : 'rgba(205,210,220,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + S(0.004), y + L); g.stroke(); }
      for (const b of balls){ blot(g, b.x, b.y, b.rad, b.c); if (night){ blot(g, b.x, b.y, b.rad, 'rgba(0,0,0,.55)'); } blot(g, b.x - b.rad * 0.35, b.y - b.rad * 0.35, b.rad * 0.3, night ? 'rgba(255,230,190,.55)' : 'rgba(255,255,255,.7)'); }
      if (night) for (const b of bulbs){ const gr = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, S(0.11)), c = new THREE.Color(b.c); gr.addColorStop(0, `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${0.45 * b.f})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(b.x - S(0.11), b.y - S(0.11), S(0.22), S(0.22)); }   // (its needles lit round each bulb)
      drawTop(g, night); };
    const bars = T.winBars(w, 0, 0, CW, CH, S), wr = T.mkRng(w.cx * 131 + w.yb * 17 + 5), age = wr(), frameCol = age < 0.5 ? '#ecebe4' : age < 0.85 ? '#e2ded2' : '#d8d0bc';
    const canvas = () => { const c = document.createElement('canvas'); c.width = CW; c.height = CH; return [c, c.getContext('2d')]; };
    // by day: the glass, the tree dim behind it, the yard given back over it, the curtains, the flowers on the sill, the frame
    const [dc, d] = canvas();
    { const gr = d.createLinearGradient(0, 0, CW * 0.4, CH); gr.addColorStop(0, '#8c9ba6'); gr.addColorStop(0.35, '#55636c'); gr.addColorStop(0.7, '#323c43'); gr.addColorStop(1, '#262d32'); d.fillStyle = gr; d.fillRect(0, 0, CW, CH);
      d.save(); d.globalAlpha = 0.8; drawTree(d, false); d.restore();
      for (let i = 0; i < 15; i++) wr(); d.save(); d.globalAlpha = 0.75; T.reflect(d, 0, 0, CW, CH, S(1), Math.round(w.cx * 131 + w.yb * 17) + 5, 0.012 * (w.yb - 1.5)); d.restore();
      d.fillStyle = 'rgba(200,215,225,.10)'; d.beginPath(); d.moveTo(CW * 0.2, 0); d.lineTo(CW * 0.5, 0); d.lineTo(CW * 0.15, CH); d.lineTo(0, CH); d.lineTo(0, CH * 0.5); d.fill();
      if (w.drape){ d.fillStyle = w.drape; d.fillRect(2 * K, 2 * K, CW * 0.17, CH - 4 * K); d.fillRect(CW * 0.83 - 2 * K, 2 * K, CW * 0.17, CH - 4 * K); }
      if (w.plant) for (let k = 0; k < 4; k++) blot(d, CW * (0.3 + k * 0.13), CH - S(0.12), 5 * K, k % 2 ? '#c03030' : '#3d6b2e');
      d.fillStyle = frameCol; for (const [x, y, bw, bh] of bars) d.fillRect(x, y, bw, bh);
      d.fillStyle = 'rgba(40,40,36,.28)'; for (const [x, y, bw, bh] of bars) if (bw > bh) d.fillRect(x, y + bh - 0.7 * K, bw, 0.7 * K);
      for (let i = 0; i < 4; i++){ const [x, y, bw, bh] = bars[Math.floor(wr() * bars.length)]; blot(d, x + wr() * bw, y + wr() * bh, (0.6 + wr()) * K, 'rgba(120,112,98,.5)'); } }
    // by night: the room (its light on, or dark and lit by the tree), the tree against it, the curtains dark, the frame black
    const [nc, n] = canvas(), lc = new THREE.Color(w.litCol);
    { if (X.room === 'lit'){ const gr = n.createRadialGradient(CW / 2, CH * 0.45, 4, CW / 2, CH / 2, CW * 0.8); gr.addColorStop(0, lc.clone().multiplyScalar(0.62).getStyle()); gr.addColorStop(1, lc.clone().multiplyScalar(0.62 * 0.45).getStyle()); n.fillStyle = gr; n.fillRect(0, 0, CW, CH); }
      else { n.fillStyle = '#0a0706'; n.fillRect(0, 0, CW, CH); const c = new THREE.Color(X.glow), gr = n.createRadialGradient(tx, fy - th * 0.55, 0, tx, fy - th * 0.55, th * 0.7);   // (the room lit only by the tree)
        gr.addColorStop(0, `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},.4)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); n.fillStyle = gr; n.fillRect(0, 0, CW, CH); }
      drawTree(n, true);
      if (w.drape){ n.fillStyle = 'rgba(70,30,10,.65)'; n.fillRect(2 * K, 2 * K, CW * 0.17, CH - 4 * K); n.fillRect(CW * 0.83 - 2 * K, 2 * K, CW * 0.17, CH - 4 * K); }
      n.fillStyle = '#000'; for (const [x, y, bw, bh] of bars) n.fillRect(x, y, bw, bh); }
    const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    const x0 = w.cx - w.w / 2 - T.BW / 2, geo = new THREE.PlaneGeometry(w.w, w.h);
    const panel = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex(dc), emissiveMap: tex(nc), emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.9 }));
    panel.position.set(x0 + w.w / 2, w.yb + w.h / 2, T.BZ + 0.012); panel.receiveShadow = true; group.add(panel);
    panel.onBeforeRender = () => { panel.material.emissiveIntensity = T.buildingFront.emissiveIntensity; };   // (lit as the front's windows are)
    // the bulbs: each a bright point in a soft glow of its colour, cut by the frame; a layer for each group
    for (let k = 0; k < 3; k++){ const [bc, b] = canvas();
      for (const q of bulbs) if (q.g === k){ const c = new THREE.Color(q.c), rgb = `${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0}`, R = S(0.07);
        const gr = b.createRadialGradient(q.x, q.y, 0, q.x, q.y, R); gr.addColorStop(0, `rgba(255,255,255,${q.f})`); gr.addColorStop(0.12, `rgba(${rgb},${q.f})`); gr.addColorStop(0.4, `rgba(${rgb},${0.3 * q.f})`); gr.addColorStop(1, `rgba(${rgb},0)`);
        b.fillStyle = gr; b.fillRect(q.x - R, q.y - R, 2 * R, 2 * R); }
      if (k === 0 && X.top !== 'spire'){ const R = S(0.16), c = X.top === 'gold' ? '255,200,90' : '255,60,40', gr = b.createRadialGradient(tx, topY - S(0.05), 0, tx, topY - S(0.05), R);   // (the star lit from inside)
        gr.addColorStop(0, `rgba(${c},.9)`); gr.addColorStop(0.3, `rgba(${c},.35)`); gr.addColorStop(1, `rgba(${c},0)`); b.fillStyle = gr; b.fillRect(tx - R, topY - S(0.05) - R, 2 * R, 2 * R); }
      b.globalCompositeOperation = 'destination-out'; b.fillStyle = '#000'; for (const [x, y, bw, bh] of bars) b.fillRect(x, y, bw, bh);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex(bc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.copy(panel.position); m.position.z += 0.003 * (k + 1); m.renderOrder = 2; group.add(m);
      const [per, way] = X.tw, ph = k * Math.PI * 2 / 3;
      m.onBeforeRender = () => { const t = performance.now() / 1000, lit = Math.min(1, T.buildingFront.emissiveIntensity / 1.6);
        let on = way === 'chase' ? 0.5 + 0.5 * Math.tanh(5 * Math.sin(Math.PI * 2 * t / per - ph)) : way === 'breathe' ? 0.72 + 0.28 * Math.sin(Math.PI * 2 * t / per + ph * 0.4)
          : (() => { const f = t / per + k * 17.3, i = Math.floor(f), u = f - i, hsh = q => { const s = Math.sin(q * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); }; return 0.35 + 0.65 * (hsh(i) + (hsh(i + 1) - hsh(i)) * u * u * (3 - 2 * u)); })();
        m.material.color.setScalar((0.3 + 0.9 * lit) * (0.15 + 0.85 * on)); };
      layers.push(m); } }
  return HOL.trees = group; }

// ---------------------------------------------------------------- the shots
var DAY = { S: 0.42, tod: 0.46 }, NOON = { S: 0.42, tod: 0.52 };
var tall = () => T.camera.aspect < 1;   // (a phone's tall frame: the yard's and the lane's cameras look a little higher, so the snow in front doesn't fill half of it)
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
      return look(vmix(V(-11.5, 5.6, -126), V(-10.2, 4.9, -127.5), ease(u)), V(2.5, tall() ? 2.2 : 0.6, -140)); } },
  // and down the gravel lane, one on each beat
  { name: 'h-lane', setup(){ world({ ...DAY, fov: 48 }); onBike(false); },
    cam(u){ const t = st_(u), B = {}; LANE.forEach((k, i) => B[k] = [i * HBEAT + 0.05, 0.7]);
      snowmen(YARD, B, t);
      return look(vmix(V(-11, 1.7, -131), V(-10.9, 1.9, -116), ease(u)), V(-8.6, tall() ? 1.3 : 0.6, mix(-108, -90, ease(u)))); } },
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
  { name: 'h-dusk', warm: 90, setup(){ world({ S: 0.42, tod: 0.705, fov: 46, weather: 'rain' }); onBike(false); snowmen([...YARD, ...LANE]); },
    cam: u => look(vmix(V(-6.6, 1.55, -128.6), V(-7.6, 3.2, -126.4), ease(u)), vmix(V(4, 1.4, -142), V(4, 2.4, -142), ease(u))) },
];
SHOTS = SHOTS.concat(HSHOTS);
window.SHOT_BEGIN = async (i, s) => { if (s) CUR = s; const sh = SHOTS[i]; xmasTrees(); face();   // (the trees put up and the face made before the first shot: the sound pass keeps time)
  await sh.setup(); window.__camLock = A() && sh.acam ? () => sh.acam(U.u, U.f) : sh.cam ? () => sh.cam(U.u, U.f) : null; };
window.SHOT_END = () => { T.keys.clear(); T.mode = 'free'; near(0.1); };   // (the bike stays mounted from one shot of the ride to the next)
