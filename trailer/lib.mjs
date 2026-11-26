// shared by render.mjs, audio.mjs and cards.mjs: the plan make_trailer.py wrote, puppeteer, Chrome
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { pathToFileURL } from 'url';

export const HERE = path.dirname(new URL(import.meta.url).pathname);

// the plan: make_trailer.py writes it into the work folder; every script takes that folder as its last argument
export function loadPlan(work){
  const file = path.join(work, 'plan.json');
  if (!fs.existsSync(file)) throw new Error(`no ${file}: run make_trailer.py, which writes it`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// puppeteer from a local node_modules if there is one, else the global install (npm i -g puppeteer)
export async function loadPuppeteer(){
  try { return (await import('puppeteer')).default; } catch (e) {}
  const root = execSync('npm root -g').toString().trim();
  return (await import(pathToFileURL(path.join(root, 'puppeteer/lib/puppeteer/puppeteer.js')).href)).default;
}

// Chrome itself (its GPU: Metal on a Mac); CHROME=/path/to/chrome to use another
export const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export async function launch(puppeteer, work, tag, { width, height }){
  return puppeteer.launch({ executablePath: CHROME, headless: 'new', protocolTimeout: 900000,
    args: ['--use-angle=metal', '--ignore-gpu-blocklist', `--window-size=${width},${height}`,
      '--user-data-dir=' + path.join(work, 'chrome-' + tag), '--autoplay-policy=no-user-gesture-required'] });
}

// open the patched game, skip its title screen, and wait for it to settle (the bather, the shaders, the textures)
export async function openGame(page, plan, { quiet = false } = {}){
  page.on('pageerror', e => console.log('page error:', e.message));
  if (!quiet) page.on('console', m => { const t = m.text(); if (/error/i.test(t) && !/GPU stall/.test(t)) console.log('page:', t.slice(0, 300)); });
  await page.goto(`http://127.0.0.1:${plan.port}/index.html?s=1.62&tod=0.36&noui`, { waitUntil: 'load', timeout: 600000 });
  await page.waitForFunction(() => window.__T && window.__T.started, { timeout: 600000, polling: 500 });
  await new Promise(r => setTimeout(r, 6000));
}
