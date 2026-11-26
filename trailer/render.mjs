// The pictures: drives the patched game on a virtual clock, one frame at a time, so every frame is exactly 1/fps
// apart however long it takes to draw. Each shot is drawn at width x height x supersample and scaled down by ffmpeg.
//   node render.mjs render WORK    every shot of the plan -> WORK/clips/<shot>.mp4
//   node render.mjs stills WORK    first, middle and last frame of each shot -> WORK/stills/
// (make_trailer.py runs it; WORK/plan.json says what to draw, how big and on which port the game is served)
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { HERE, loadPlan, loadPuppeteer, launch, openGame } from './lib.mjs';

const [, , MODE = 'render', WORK = path.join(HERE, 'work')] = process.argv;
const plan = loadPlan(WORK), { width: W, height: H, fps: FPS, supersample: SS } = plan;

// the virtual clock: performance.now and requestAnimationFrame belong to us once __vtOn() is called
const SHIM = `(() => {
  const rNow = performance.now.bind(performance), rRAF = window.requestAnimationFrame.bind(window);
  let virt = false, base = 0, vt = 0, q = [];
  const waiting = new Set();
  performance.now = () => virt ? base + vt : rNow();
  // (each real request runs at most once: those still waiting when the virtual clock takes over are handed to it, so the first step
  // draws a frame instead of waiting on the browser's own clock, and does not run twice if that fires after all)
  window.requestAnimationFrame = cb => { if (virt){ q.push(cb); return q.length; } const once = t => { if (waiting.delete(once)) cb(t); }; waiting.add(once); return rRAF(once); };
  window.__vtOn = () => { base = rNow(); vt = 0; virt = true; q.push(...waiting); };
  window.__step = ms => { vt += ms; const c = q; q = []; const t = base + vt; for (const f of c) f(t); };
})();`;

const puppeteer = await loadPuppeteer();
const browser = await launch(puppeteer, WORK, 'render', { width: W, height: H });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: SS });
await page.evaluateOnNewDocument(SHIM);
const t0 = Date.now();
await openGame(page, plan);
await page.evaluate(fs.readFileSync(path.join(HERE, 'shots.js'), 'utf8'));
await page.evaluate(() => window.__vtOn());
console.log(`game up in ${((Date.now() - t0) / 1000).toFixed(1)} s; drawing at ${W * SS}x${H * SS}, ${FPS} fps`);

const names = await page.evaluate(() => SHOTS.map(s => s.name));
const warmOf = await page.evaluate(() => Object.fromEntries(SHOTS.map(s => [s.name, s.warm ?? 45])));   // (warm-up frames before a shot, counted at 30 fps)
const ms = 1000 / FPS;
// a frame, as JPEG; drawn again if it comes back black (once in a while the first frame after the game loads does; no shot is ever black)
const grab = (u, f) => page.evaluate((u, f, ms, q) => { const cv = document.querySelector('canvas'), probe = document.createElement('canvas'); probe.width = 32; probe.height = 18;
  const g = probe.getContext('2d', { willReadFrequently: true });
  for (let tries = 0; ; tries++){ __setU(u, f); __step(ms); g.drawImage(cv, 0, 0, 32, 18);
    const px = g.getImageData(0, 0, 32, 18).data; let sum = 0; for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
    if (sum > 32 * 18 * 6 || tries >= 3) return cv.toDataURL('image/jpeg', q).slice(23); } }, u, f, ms, plan.jpegq ?? 0.94);
const step = (u, f) => page.evaluate((u, f, ms) => { __setU(u, f); __step(ms); }, u, f, ms);
const out = path.join(WORK, MODE === 'render' ? 'clips' : 'stills'); fs.mkdirSync(out, { recursive: true });

for (const [k, s] of plan.shots.entries()){
  const i = names.indexOf(s.name); if (i < 0) throw new Error(`shot ${s.name} is not in shots.js`);
  const ts = Date.now(), frames = s.frames;
  await page.evaluate(i => SHOT_BEGIN(i), i);
  for (let w = 0, n = Math.round(warmOf[s.name] * FPS / 30); w < n; w++) await step(0, -1);
  let ff = null, put = null;
  if (MODE === 'render'){
    ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-vf', `scale=${W}:${H}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '6', '-pix_fmt', 'yuv444p', path.join(out, s.name + '.mp4')],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    put = buf => new Promise(r => ff.stdin.write(buf) ? r() : ff.stdin.once('drain', r));
  }
  const picks = { 0: 'a', [Math.floor((frames - 1) / 2)]: 'b', [frames - 1]: 'c' };
  for (let f = 0; f < frames; f++){ const u = Math.min(1, (frames > 1 ? f / (frames - 1) : 0) / (s.move || 1));   // (the camera done moving at s.move: it holds)
    if (MODE === 'render') await put(Buffer.from(await grab(u, f), 'base64'));
    else if (picks[f]) fs.writeFileSync(path.join(out, `${String(k).padStart(2, '0')}-${s.name}-${picks[f]}.jpg`), Buffer.from(await grab(u, f), 'base64'));
    else await step(u, f); }
  if (ff){ ff.stdin.end(); await new Promise(r => ff.on('close', r)); }
  await page.evaluate(() => SHOT_END());
  console.log(`  ${s.name.padEnd(10)} ${String(frames).padStart(4)} frames  ${((Date.now() - ts) / 1000).toFixed(1)} s`);
}
await browser.close();
