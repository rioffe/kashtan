// The holiday promo's music: Jingle Bells (James Lord Pierpont, 1857; public domain), arranged on the promo's bars and played by
// synthesized instruments in Chrome's Web Audio, offline: the same every run, and on the cut's bars to the sample (bar 0 is the
// video's first frame). The glockenspiel is the game's own bell (partials 1, 2.76, 5.4).
//   intro   2 bars  the last line, "one horse open sleigh", on the glockenspiel, sleigh bells coming in
//   verse   8 bars  "Dashing through the snow": glockenspiel, a woodblock trotting, bass and electric piano, oom-pah
//   chorus 16 bars  "Jingle bells": the tune on electric piano, glockenspiel and horns, walking bass, brushes, strings; a crash on "hey!"
//   ending  4 bars  "one horse open sleigh" once more, and a last chord with the glockenspiel climbing over it
//   node music.mjs WORK    -> plan.music.out (WORK/music.wav)
import fs from 'fs';
import path from 'path';
import { HERE, loadPlan, loadPuppeteer, launch } from './lib.mjs';

const WORK = process.argv[2] || path.join(HERE, 'work', 'holiday'), plan = loadPlan(WORK), M = plan.music;

async function synth({ bpm, bars, tail }){
  const SR = 48000, BEAT = 60 / bpm, BAR = 4 * BEAT, LEN = bars * BAR + tail + 0.5;
  const ctx = new OfflineAudioContext(2, Math.ceil(LEN * SR), SR);
  let seed = 1225; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const mtof = m => 440 * 2 ** ((m - 69) / 12), at = (bar, beat = 0) => bar * BAR + beat * BEAT, hum = () => (rnd() - 0.5) * 0.006;
  // the room: a plate of reverb under everything, a gentle compressor over it
  const master = ctx.createGain(), comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 2.5; comp.attack.value = 0.008; comp.release.value = 0.25; comp.knee.value = 8;
  master.connect(comp); comp.connect(ctx.destination);
  const rev = ctx.createConvolver(); { const n = Math.floor(SR * 2.6), b = ctx.createBuffer(2, n, SR);
    for (let c = 0; c < 2; c++){ const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++){ const k = i / n; lp += ((rnd() * 2 - 1) - lp) * (0.75 - 0.5 * k); d[i] = lp * Math.exp(-i / SR / 0.36) * Math.min(1, i / (SR * 0.004)); } }
    rev.buffer = b; }
  const revG = ctx.createGain(); revG.gain.value = 0.5; rev.connect(revG); revG.connect(master);
  const bus = (g, send) => { const n = ctx.createGain(); n.gain.value = g; n.connect(master); const s = ctx.createGain(); s.gain.value = send; n.connect(s); s.connect(rev); return n; };
  const GLOCK = bus(1, 0.5), EP = bus(1, 0.28), HORN = bus(1, 0.3), BASS = bus(1, 0.05), PAD = bus(1, 0.45), BELLS = bus(1, 0.22), DRUMS = bus(1, 0.12);
  const noise = ctx.createBuffer(1, SR * 2, SR); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
  const osc = (type, f, t0, t1, out, detune = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.connect(out); o.start(t0); o.stop(t1); return o; };
  const pan = (p, out) => { const n = ctx.createStereoPanner(); n.pan.value = p; n.connect(out); return n; };
  const hit = (t, out, v, tau) => { const g = ctx.createGain(); g.connect(out); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, tau); return g; };
  const noiseHit = (t, out, type, f, q, v, tau, len = 0.4) => { const s = ctx.createBufferSource(), bf = ctx.createBiquadFilter(); s.buffer = noise; bf.type = type; bf.frequency.value = f; bf.Q.value = q;
    s.connect(bf); bf.connect(hit(t, out, v, tau)); s.start(t, rnd() * 1.5); s.stop(t + len); };

  // ---- the instruments
  // glockenspiel: the game's bell, struck harder (its upper partials brighter and quicker)
  function glock(t, m, v, p = (rnd() - 0.5) * 0.3){ const f = mtof(m), o = pan(p, GLOCK);
    osc('sine', f, t, t + 3.2, hit(t, o, v, 0.6));
    for (const [r, a, tau] of [[2.76, 0.3, 0.14], [5.4, 0.12, 0.05], [8.93, 0.05, 0.025]]) osc('sine', f * r, t, t + 1, hit(t, o, v * a, tau)); }
  // electric piano: a tine and its bar, FM (a sine modulating a sine at the same pitch, the modulation dying away), quicker up high
  function ep(t, m, v, dur, p = 0){ const f = mtof(m), o = pan(p, EP), g = ctx.createGain(), end = t + dur, tau = 1.4 * Math.pow(0.5, (m - 60) / 24);
    g.connect(o); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.setTargetAtTime(0, t + 0.003, tau); g.gain.setTargetAtTime(0, end, 0.07);
    const car = osc('sine', f, t, end + 0.6, g), mod = ctx.createOscillator(), mg = ctx.createGain(); mod.frequency.value = f; mg.gain.setValueAtTime(f * 2.4 * Math.min(1, v * 6), t); mg.gain.setTargetAtTime(f * 0.25, t, 0.16);
    mod.connect(mg); mg.connect(car.frequency); mod.start(t); mod.stop(end + 0.6);
    osc('sine', f * 7, t, t + 0.2, hit(t, o, v * 0.05, 0.02)); }   // (the tine's tick)
  // horns: two sawtooths a few cents apart through a filter that opens on the attack, a vibrato coming in as the note is held
  function horn(t, m, v, dur, p = 0.15){ const f = mtof(m), o = pan(p, HORN), g = ctx.createGain(), lp = ctx.createBiquadFilter(), end = t + dur;
    lp.type = 'lowpass'; lp.Q.value = 1.2; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(2600, t + 0.05); lp.frequency.setTargetAtTime(1400, t + 0.05, 0.15);
    lp.connect(g); g.connect(o); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.03); g.gain.setTargetAtTime(v * 0.7, t + 0.03, 0.2); g.gain.setTargetAtTime(0, end, 0.05);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.4; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(0, t + 0.18); lg.gain.linearRampToValueAtTime(14, t + 0.5); lfo.connect(lg);
    for (const d of [-6, 6]){ const s = osc('sawtooth', f, t, end + 0.3, lp, d); lg.connect(s.detune); } lfo.start(t); lfo.stop(end + 0.3); }
  // a plucked double bass
  function bass(t, m, v, dur){ v *= 0.32; const f = mtof(m), g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1500, t); lp.frequency.setTargetAtTime(420, t, 0.07);
    lp.connect(g); g.connect(BASS); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.setTargetAtTime(0, t + 0.005, 0.32); g.gain.setTargetAtTime(0, t + dur, 0.06);
    osc('triangle', f, t, t + dur + 0.4, lp); osc('sine', f, t, t + dur + 0.4, lp); noiseHit(t, BASS, 'lowpass', 300, 0.7, v * 0.25, 0.015, 0.06); }
  // strings, held under the chords
  function pad(t, notes, dur, v, cut = 1700){ for (const m of notes){ const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut; lp.Q.value = 0.3;
    lp.connect(g); g.connect(pan((rnd() - 0.5) * 0.7, PAD)); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + Math.min(0.35, dur * 0.3)); g.gain.setValueAtTime(v, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.45);
    for (const d of [-9, 0, 9]) osc('sawtooth', mtof(m), t, t + dur + 0.5, lp, d + (rnd() - 0.5) * 4); } }
  // sleigh bells: a handful of little bells (two inharmonic partials each, high up) and their rattle, shaken
  function sleigh(t, v){ v *= 2.5; for (let k = 0; k < 6; k++){ const tt = t + rnd() * 0.018, f = 4200 + rnd() * 3600, g = hit(tt, pan((rnd() - 0.5) * 0.8, BELLS), v * (0.4 + rnd() * 0.6), 0.018 + rnd() * 0.035);
      osc('sine', f, tt, tt + 0.25, g); osc('sine', f * 1.47, tt, tt + 0.25, g); }
    noiseHit(t, BELLS, 'highpass', 7000, 0.7, v * 1.6, 0.03, 0.2); }
  const block = (t, f, v) => { osc('sine', f, t, t + 0.15, hit(t, DRUMS, v, 0.022)); noiseHit(t, DRUMS, 'bandpass', f * 2.2, 6, v * 0.5, 0.01, 0.05); };
  const kick = (t, v) => { const o = ctx.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.09); o.connect(hit(t, DRUMS, v, 0.11)); o.start(t); o.stop(t + 0.5); };
  const brush = (t, v) => { noiseHit(t, DRUMS, 'bandpass', 2600, 0.6, v, 0.07, 0.3); noiseHit(t - 0.03, DRUMS, 'highpass', 5000, 0.5, v * 0.25, 0.05, 0.1); };
  const crash = (t, v) => { noiseHit(t, DRUMS, 'highpass', 4800, 0.5, v, 0.9, 3); noiseHit(t, DRUMS, 'bandpass', 3400, 1.5, v * 0.5, 0.4, 2); };

  // ---- the score (G major). Melodies as [note, beats], 0 a rest
  const INTRO = [[74, 1], [74, 1], [72, 1], [69, 1], [67, 2], [0, 2]];
  const VERSE = [[62, 1], [71, 1], [69, 1], [67, 1], [62, 3], [62, 0.5], [62, 0.5], [62, 1], [71, 1], [69, 1], [67, 1], [64, 3], [0, 1],
    [64, 1], [72, 1], [71, 1], [69, 1], [66, 3], [0, 1], [74, 1], [74, 1], [72, 1], [69, 1], [71, 2], [0, 2]];
  const JB = [[71, 1], [71, 1], [71, 2], [71, 1], [71, 1], [71, 2], [71, 1], [74, 1], [67, 1.5], [69, 0.5], [71, 3], [0, 1]];
  const CHORUS = [...JB, [72, 1], [72, 1], [72, 1.5], [72, 0.5], [72, 1], [71, 1], [71, 1], [71, 0.5], [71, 0.5], [71, 1], [69, 1], [69, 1], [71, 1], [69, 2], [74, 2],
    ...JB, [72, 1], [72, 1], [72, 1], [72, 1], [72, 1], [71, 1], [71, 1], [71, 0.5], [71, 0.5], [74, 1], [74, 1], [72, 1], [69, 1], [67, 3], [0, 1]];
  const OUTRO = [[74, 1], [74, 1], [72, 1], [69, 1], [67, 4]];
  // chords: bass root, bass fifth, the chord (voiced round middle C)
  const CH = { G: [43, 50, [55, 59, 62]], C: [48, 43, [55, 60, 64]], Am: [45, 40, [57, 60, 64]], D7: [38, 45, [54, 57, 60]], A7: [45, 40, [55, 61, 64]] };
  const PROG = { intro: ['D7', 'G'], verse: ['G', 'G', 'G', 'C', 'Am', 'D7', 'D7', 'G'],
    chorus: ['G', 'G', 'G', 'G', 'C', 'G', 'A7', 'D7', 'G', 'G', 'G', 'G', 'C', 'G', 'D7', 'G'], outro: ['D7', 'G'] };
  const SEC = { intro: 0, verse: 2, chorus: 10, outro: 26 };
  const play = (mel, bar0, fn) => { let b = 0; for (const [m, d] of mel){ if (m) fn(Math.max(0, at(bar0, b) + hum()), m, d * BEAT); b += d; } };

  // intro: the tune's last line on the glockenspiel, strings under it, the sleigh bells shaken in
  play(INTRO, SEC.intro, (t, m, d) => glock(t, m + 12, 0.2));
  pad(at(0), CH.D7[2], BAR, 0.006, 1100); pad(at(1), CH.G[2], BAR, 0.006, 1100);
  for (let i = 0; i < 16; i++) sleigh(at(0, i / 2), 0.012 + 0.03 * i / 15);
  bass(at(1, 2), 38, 0.25, BEAT * 0.9); bass(at(1, 3), 42, 0.25, BEAT * 0.9);   // (walking up to the verse: D, F#)

  // verse: oom-pah, the woodblock trotting, the bells on two and four
  play(VERSE, SEC.verse, (t, m, d) => { glock(t, m + 12, 0.2); ep(t, m, 0.05, d * 0.9, 0.1); });
  PROG.verse.forEach((c, i) => { const bar = SEC.verse + i, [r, fifth, ch] = CH[c], last = i === 7;
    bass(at(bar, 0) + hum(), r, 0.38, BEAT * 0.9); bass(at(bar, 2) + hum(), last ? 38 : fifth, 0.32, BEAT * 0.9);
    for (const b of last ? [1] : [1, 3]) for (const m of ch) ep(at(bar, b) + hum(), m, 0.035, BEAT * 0.4, (m - 58) / 20);
    for (let k = 0; k < (last ? 4 : 8); k++){ block(at(bar, k / 2), k % 2 ? 760 : 1020, k % 2 ? 0.05 : 0.07); sleigh(at(bar, k / 2), k % 4 === 2 ? 0.05 : 0.018); } });
  // into the chorus: the glockenspiel up a scale, a brush roll, the bells shaken hard, the bass up to G
  [67, 69, 71, 72, 74, 76, 78, 79].forEach((m, i) => glock(at(9, 2 + i / 4), m + 12, 0.1 + 0.012 * i));
  for (let i = 0; i < 8; i++){ brush(at(9, 2 + i / 4), 0.03 + 0.03 * i / 7); sleigh(at(9, 2 + i / 4), 0.03 + 0.03 * i / 7); }
  for (const m of CH.D7[2]) ep(at(9, 2), m, 0.05, BEAT * 1.8);
  bass(at(9, 2), 38, 0.35, BEAT * 0.9); bass(at(9, 3), 42, 0.35, BEAT * 0.9);

  // chorus: the tune on electric piano, glockenspiel an octave up, the horns holding it; walking bass, brushes, kick, strings
  play(CHORUS, SEC.chorus, (t, m, d) => { ep(t, m, 0.13, d * 0.92, 0); glock(t, m + 12, 0.09); horn(t, m, 0.03, d * 0.95); });
  PROG.chorus.forEach((c, i) => { const bar = SEC.chorus + i, [r, , ch] = CH[c], next = CH[PROG.chorus[i + 1] || 'D7'][0];
    const third = r + (c === 'Am' ? 3 : 4), walk = [r, third, r + 7, next > r ? next - 1 : next === r ? r + 9 : next + 1];
    walk.forEach((m, b) => bass(at(bar, b) + hum(), m, b ? 0.3 : 0.36, BEAT * 0.85));
    for (const b of [1, 3]) for (const m of ch) ep(at(bar, b) + hum(), m, 0.04, BEAT * 0.35, (m - 58) / 20);
    pad(at(bar), ch.map(m => m + 12), BAR * 0.98, 0.006, 1900);
    kick(at(bar, 0), 0.12); kick(at(bar, 2), 0.09); brush(at(bar, 1), 0.07); brush(at(bar, 3), 0.07);
    for (let k = 0; k < 8; k++) sleigh(at(bar, k / 2), k % 2 ? 0.02 : 0.034);
    if (i % 2 === 1) for (let k = 0; k < 4; k++) sleigh(at(bar, 3 + k / 4), 0.025); });
  crash(at(SEC.chorus + 7, 2), 0.05);                                    // "hey!"
  for (const m of [...CH.D7[2], 62]) ep(at(SEC.chorus + 7, 2), m, 0.07, BEAT * 1.6);
  crash(at(SEC.chorus + 15, 0), 0.04);                                    // "sleigh!"
  // the second time round, the glockenspiel sparkling over it in eighths
  PROG.chorus.slice(8, 15).forEach((c, i) => { const ch = CH[c][2]; for (let k = 0; k < 8; k++) glock(at(SEC.chorus + 8 + i, k / 2) + hum(), ch[[0, 1, 2, 1][k % 4]] + 24, 0.025); });

  // ending: "one horse open sleigh" once more, softer; then the last chord, the glockenspiel climbing, the bells shaken out
  play(OUTRO, SEC.outro, (t, m, d) => { glock(t, m + 12, 0.15); ep(t, m, 0.08, Math.min(d, BEAT * 3) * 0.95); horn(t, m, 0.022, Math.min(d, BEAT * 3)); });
  PROG.outro.forEach((c, i) => { const bar = SEC.outro + i, [r, fifth, ch] = CH[c]; bass(at(bar, 0), r, 0.34, BEAT * 0.9); bass(at(bar, 2), fifth, 0.28, BEAT * 0.9);
    for (const b of [1, 3]) for (const m of ch) ep(at(bar, b), m, 0.03, BEAT * 0.35); pad(at(bar), ch.map(m => m + 12), BAR, 0.004, 1500);
    for (let k = 0; k < 8; k++) sleigh(at(bar, k / 2), k % 2 ? 0.014 : 0.024); });
  const fin = at(SEC.outro + 2);   // the last chord: G with a sixth and a ninth, held to the end
  bass(fin, 31, 0.3, BAR * 2.4); bass(fin, 43, 0.22, BAR * 2.4); pad(fin, [55, 59, 62, 64, 69], BAR * 2.3, 0.006, 1300);
  for (const m of [55, 59, 64, 69]) ep(fin, m, 0.05, BAR * 2.3, (m - 60) / 20);
  [79, 83, 86, 88, 91, 95].forEach((m, i) => glock(fin + i * BEAT / 2, m, 0.09 - 0.008 * i, (i - 2.5) / 4));
  glock(at(SEC.outro + 3, 0), 91, 0.07, 0);
  for (let i = 0; i < 12; i++) sleigh(fin + i * BEAT / 3, 0.035 * (1 - i / 12));
  crash(fin, 0.025);

  const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), N = buf.length;
  let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const k = 0.89 / peak, rms = (a, b) => { let s = 0; for (let i = Math.floor(a * SR); i < Math.min(N, b * SR); i++) s += (L[i] * L[i] + R[i] * R[i]) / 2; return Math.sqrt(s / ((b - a) * SR)) * k; };
  const db = x => (20 * Math.log10(x)).toFixed(1);
  const report = `peak ${db(peak)} dBFS before normalizing; loudness (RMS) intro ${db(rms(0, at(2)))} verse ${db(rms(at(2), at(10)))} chorus ${db(rms(at(10), at(26)))} ending ${db(rms(at(26), at(30)))} dB`;
  // 16-bit WAV, 48 kHz stereo
  const out = new DataView(new ArrayBuffer(44 + N * 4)), str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + N * 4, true); str(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
  out.setUint32(24, SR, true); out.setUint32(28, SR * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, N * 4, true);
  for (let i = 0; i < N; i++){ out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i] * k)) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i] * k)) * 32767, true); }
  const u8 = new Uint8Array(out.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return [btoa(s), report];
}

const puppeteer = await loadPuppeteer();
const browser = await launch(puppeteer, WORK, 'music', { width: 400, height: 300 });
const page = await browser.newPage();
const t0 = Date.now();
const [b64, report] = await page.evaluate(synth, { bpm: M.bpm, bars: M.bars, tail: M.tail });
fs.writeFileSync(M.out, Buffer.from(b64, 'base64'));
await browser.close();
console.log(`  ${M.bars} bars at ${M.bpm} a minute, ${((Date.now() - t0) / 1000).toFixed(1)} s to play; ${report}`);
