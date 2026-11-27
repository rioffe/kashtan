// The sound: the game's own audio, recorded off its output while the plan's shots are played through in real time
// (the music is generative and scheduled on the audio clock, so this pass cannot run faster than the trailer is long;
// every run is a new performance). Each scene is switched in at the middle of its crossfade; a shot may name an `acam`
// in shots.js to be heard from somewhere other than where it is seen (the synagogue's violin carried under the town).
//   node audio.mjs WORK    -> WORK/audio.webm
import fs from 'fs';
import path from 'path';
import { HERE, loadPlan, loadPuppeteer, launch, openGame } from './lib.mjs';

const WORK = process.argv[2] || path.join(HERE, 'work'), plan = loadPlan(WORK);
// every connection to the speakers is also made to a recorder's input
const HOOK = `(() => { const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...a){ const r = oc.call(this, d, ...a);
    if (d instanceof AudioDestinationNode){ const c = this.context; if (!c.__tap){ c.__tap = c.createMediaStreamDestination(); window.__tapNode = c.__tap; } oc.call(this, c.__tap); }
    return r; }; })();`;
const timeline = plan.shots.map((s, k) => ({ ...s, dur: s.dur * (s.move || 1), sw: k ? s.start + (s.xf ?? plan.xf) / 2 : 0 }));   // (dur: while its camera moves)

const puppeteer = await loadPuppeteer();
const browser = await launch(puppeteer, WORK, 'audio', { width: 960, height: 540 });
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(HOOK);
await openGame(page, plan);
await page.evaluate(() => { window.__AUDIO = true; });
for (const f of plan.shotFiles ?? ['shots.js']) await page.evaluate(fs.readFileSync(path.join(HERE, f), 'utf8'));
console.log(`recording ${plan.total.toFixed(1)} s of sound in real time`);
page.on('console', m => { const t = m.text(); if (t.startsWith('AUD')) console.log('  ' + t.slice(4)); });
const b64 = await page.evaluate(async (timeline, total, lead) => {
  const names = SHOTS.map(s => s.name);
  await SHOT_BEGIN(names.indexOf(timeline[0].name), timeline[0]);
  __T.sfx.start(); if (lead.mute && __T.sfx.on) __T.sfx.toggle();   // (a cut with its own music: the game's own left out)
  await new Promise(r => setTimeout(r, lead.wait));   // (and the sound let come up first: the game fades it in over 5 s)
  const rec = new MediaRecorder(window.__tapNode.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 320000 }), chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data); rec.start(500);
  const t0 = performance.now(), el = () => (performance.now() - t0) / 1000; let cur = 0;
  console.log('AUD ' + timeline[0].name.padEnd(10) + ' 0.0 s');
  const drive = setInterval(() => { const p = timeline[cur]; __setU(Math.max(0, Math.min(1, (el() - p.start) / p.dur)), 0); }, 30);
  for (let k = 1; k < timeline.length; k++){
    while (el() < timeline[k].sw && el() < total) await new Promise(r => setTimeout(r, 20));
    if (el() >= total) break;
    SHOT_END(); cur = k; await SHOT_BEGIN(names.indexOf(timeline[k].name), timeline[k]); console.log('AUD ' + timeline[k].name.padEnd(10) + ' ' + el().toFixed(1) + ' s'); }
  while (el() < total + 0.5) await new Promise(r => setTimeout(r, 50));
  clearInterval(drive); await new Promise(r => { rec.onstop = r; rec.stop(); });
  const u8 = new Uint8Array(await new Blob(chunks, { type: 'audio/webm' }).arrayBuffer()); let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s); }, timeline, plan.total, { mute: plan.gameMusic === false, wait: plan.gameMusic === false ? 5500 : 100 });
fs.writeFileSync(path.join(WORK, 'audio.webm'), Buffer.from(b64, 'base64'));
await browser.close();
