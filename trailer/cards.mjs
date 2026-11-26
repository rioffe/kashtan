// The words: each card a transparent PNG the size of the trailer, in the game's own type (Cormorant Garamond, Inter).
// Two layouts: landscape (laid out for 1920x1080) and, for a frame as tall as it is wide or taller, portrait (laid out
// 1080 wide, clear of the phone apps' buttons and captions). Either is scaled to the plan's size.
//   node cards.mjs WORK    the cards the plan uses -> WORK/cards/<card>.png
import fs from 'fs';
import path from 'path';
import { HERE, loadPlan, loadPuppeteer, launch } from './lib.mjs';

const WORK = process.argv[2] || path.join(HERE, 'work'), plan = loadPlan(WORK);
const cap = (t) => `<div class="cap">${t}</div>`;
// the cards; make_trailer.py's EDIT table says which shot each one goes over
export const CARDS = {
  intro: `<div class="cap"><div class="sub">Engelsa iela 78 · Rīga · 1984</div>A long gravel road, the garages, the old ladies’ gardens —<br>and at the end of it, to the right, the tree.</div>`,
  candles: cap('In May it lit a thousand white candles,<br>and the whole yard smelled of them.'),
  autumn: cap('Chestnuts fell like small brown planets,<br>cracking out of their green shells.'),
  chess: cap('Reykjavík, 1972: Fischer – Spassky, the sixth game.'),
  roof: cap('All of Rīga from the roof of the tall house on Stabu,<br>and our chestnut over the roofs.'),
  title: `<div class="shade"></div><div class="end"><div class="ru">Каштан · Kastaņa</div><h1>Kashtan</h1><div class="tag">A meditation on a chestnut tree · Rīga, 1984</div>
    <div class="url">rioffe.github.io/kashtan</div><div class="langs">Plays in your browser · English · Русский · Latviešu</div></div>`,
};
// landscape: laid out for 1920x1080, captions low in the frame as in the game
const CSS_WIDE = `
  html,body{margin:0;width:100vw;height:100vh;background:transparent;overflow:hidden}
  body{position:relative;color:#f4efe6;-webkit-font-smoothing:antialiased}
  .cap{position:absolute;left:50%;bottom:118px;transform:translateX(-50%);width:min(1500px,calc(100% - 120px));text-align:center;font-family:'Cormorant Garamond',Georgia,serif;
    font-style:italic;font-size:46px;line-height:1.32;text-shadow:0 2px 18px rgba(0,0,0,.85),0 0 3px rgba(0,0,0,.7)}
  .sub{font-family:Inter,system-ui,sans-serif;font-style:normal;font-size:19px;letter-spacing:.32em;text-transform:uppercase;color:rgba(244,239,230,.82);margin-bottom:18px}
  .shade{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(8,9,12,0) 30%,rgba(8,9,12,.42) 55%,rgba(8,9,12,.78) 100%)}
  .end{position:absolute;left:0;right:0;bottom:92px;text-align:center;text-shadow:0 2px 20px rgba(0,0,0,.6)}
  .ru{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:38px;color:#e8c27a;letter-spacing:.08em}
  h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:400;font-size:168px;letter-spacing:.04em;line-height:1;margin:6px 0 10px}
  .tag{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:40px}
  .url{font-family:Inter,system-ui,sans-serif;font-weight:500;font-size:30px;letter-spacing:.06em;color:#e8c27a;margin-top:46px}
  .langs{font-family:Inter,system-ui,sans-serif;font-size:17px;letter-spacing:.24em;text-transform:uppercase;color:rgba(244,239,230,.72);margin-top:14px}`;
// portrait and square (Reels, Stories, TikTok, Shorts): laid out 1080 wide, the type larger, the lines left to wrap, and everything
// kept clear of the apps' own furniture: the bottom ~quarter (name, caption, sound), the top ~tenth, the buttons down the right
const CSS_TALL = `
  html,body{margin:0;width:100vw;height:100vh;background:transparent;overflow:hidden}
  body{position:relative;color:#f4efe6;-webkit-font-smoothing:antialiased}
  .cap{position:absolute;left:150px;right:150px;bottom:27vh;text-align:center;text-wrap:balance;font-family:'Cormorant Garamond',Georgia,serif;
    font-style:italic;font-size:60px;line-height:1.24;text-shadow:0 2px 22px rgba(0,0,0,.9),0 0 4px rgba(0,0,0,.75)}
  .sub{font-family:Inter,system-ui,sans-serif;font-style:normal;font-size:22px;letter-spacing:.28em;text-transform:uppercase;color:rgba(244,239,230,.85);margin-bottom:22px;text-wrap:balance}
  .shade{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(8,9,12,0) 28%,rgba(8,9,12,.45) 48%,rgba(8,9,12,.8) 72%,rgba(8,9,12,.86) 100%)}
  .end{position:absolute;left:120px;right:120px;bottom:27vh;text-align:center;text-shadow:0 2px 20px rgba(0,0,0,.6)}
  .ru{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:42px;color:#e8c27a;letter-spacing:.08em}
  h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:400;font-size:156px;letter-spacing:.04em;line-height:1;margin:8px 0 14px}
  .tag{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:46px;line-height:1.25;text-wrap:balance}
  .url{font-family:Inter,system-ui,sans-serif;font-weight:500;font-size:38px;letter-spacing:.05em;color:#e8c27a;margin-top:52px}
  .langs{font-family:Inter,system-ui,sans-serif;font-size:21px;line-height:1.6;letter-spacing:.2em;text-transform:uppercase;color:rgba(244,239,230,.75);margin-top:16px;text-wrap:balance}`;
const TALL = plan.layout !== 'landscape', CSS = TALL ? CSS_TALL : CSS_WIDE;

// the layout fitted to the frame: the page is the frame divided by the scale; drawn larger by Chrome for a bigger frame
// (4K), and for a smaller one drawn at 1:1 and scaled down when the trailer is put together
const s = TALL ? plan.width / 1080 : Math.min(plan.width / 1920, plan.height / 1080), vw = Math.round(plan.width / s), vh = Math.round(plan.height / s);
const puppeteer = await loadPuppeteer();
const browser = await launch(puppeteer, WORK, 'cards', { width: vw, height: vh });
const page = await browser.newPage();
await page.setViewport({ width: vw, height: vh, deviceScaleFactor: Math.max(1, s) });
const out = path.join(WORK, 'cards'); fs.mkdirSync(out, { recursive: true });
for (const k of new Set(plan.cards.map(c => c.card))){
  if (!CARDS[k]) throw new Error(`no card called ${k} in cards.mjs`);
  fs.writeFileSync(path.join(plan.site, 'card.html'), `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500&display=block" rel="stylesheet"><style>${CSS}</style></head><body>${TALL ? CARDS[k].replace(/<br>/g, ' ') : CARDS[k]}</body></html>`);   // (portrait: the lines left to wrap)
  await page.goto(`http://127.0.0.1:${plan.port}/card.html?${k}`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(async () => { for (const f of ["italic 46px 'Cormorant Garamond'", "400 168px 'Cormorant Garamond'", '500 30px Inter', '17px Inter']) await document.fonts.load(f); await document.fonts.ready; });
  const ok = await page.evaluate(() => document.fonts.check("italic 46px 'Cormorant Garamond'") && document.fonts.check('17px Inter'));
  await page.screenshot({ path: path.join(out, k + '.png'), omitBackground: true });
  console.log(`  ${k.padEnd(8)} ${ok ? '' : '(the web fonts did not load: drawn in Georgia / system sans)'}`);
}
await browser.close();
