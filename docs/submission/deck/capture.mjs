/**
 * Captures the gameplay screenshots used in the demo deck and the README, then prints the deck to PDF.
 *
 *   npm run dev                              # in another terminal (the script drives http://localhost:5173)
 *   node docs/submission/deck/capture.mjs    # screenshots + PDF
 *   node docs/submission/deck/capture.mjs --pdf-only
 *
 * No dependencies: it starts a headless Edge or Chrome and talks to it over the DevTools protocol.
 * The flight is the guided Jupiter demo (fixed seed), answered with each card's default option, so the
 * pictures are reproducible. Nothing here is generated imagery: every picture is the running game.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, 'shots');
const PDF = join(HERE, '..', 'MARGIN_Demo.pdf');
const GAME = process.env.MARGIN_URL ?? 'http://localhost:5173/';
const PORT = 9377;
const BROWSERS = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

/** The pictures the deck and README use. Every decision card is answered, but only these are saved. */
const KEEP = new Set(['design-studio', 'launch-routes', 'review-board', 'card-engine-valves-acting-up', 'hindsight']);

/** Credited NASA imagery from public/img (see public/img/credits.json), used on the first and last slides. */
const ART = ['jupiter', 'mars-climate', 'jupiter-interior', 'moon-ice'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const exe = BROWSERS.find((p) => existsSync(p));
  if (!exe) throw new Error('No Edge or Chrome found. Set BROWSER_PATH.');
  const profile = mkdtempSync(join(tmpdir(), 'margin-deck-'));
  const child = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch {
      // not up yet
    }
  }
  if (!target) throw new Error('The browser did not start.');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => {
    ws.onopen = ok;
    ws.onerror = fail;
  });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) {
      const { ok, fail } = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) fail(new Error(msg.error.message));
      else ok(msg.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      waiting.set(++id, { ok, fail });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const close = async () => {
    ws.close();
    child.kill();
    await sleep(500);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  };
  return { send, close };
}

/** Run an async function body in the page and return its value. */
const run = async (send, body) => {
  const r = await send('Runtime.evaluate', { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};

async function screenshots() {
  mkdirSync(SHOTS, { recursive: true });
  const { send, close } = await launch();
  const shot = async (name) => {
    if (!KEEP.has(name)) return;
    const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
    writeFileSync(join(SHOTS, `${name}.jpg`), Buffer.from(data, 'base64'));
    console.log('shot', name);
  };
  try {
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
    await send('Page.navigate', { url: GAME });
    await sleep(2500);
    // No first-visit tips over the pictures, and a clean session.
    await run(send, `localStorage.setItem('margin.coach.design.v1', 'done'); sessionStorage.clear(); location.reload();`);
    await sleep(2500);

    // 0. The NASA images the deck shows, re-saved as JPEG: a PDF stores JPEG as it is, but re-encodes WebP many times larger.
    for (const name of ART) {
      const data = await run(send, `
        const bitmap = await createImageBitmap(await (await fetch('img/${name}.webp')).blob());
        const canvas = Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
        canvas.getContext('2d').drawImage(bitmap, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
      `);
      writeFileSync(join(SHOTS, `nasa-${name}.jpg`), Buffer.from(data, 'base64'));
      console.log('art', name);
    }
    if (process.argv.includes('--art-only')) return;

    // 1. Design studio: an MRO-like Mars orbiter, then swap in the bigger radio so the ripple chips show.
    await run(send, `
      const { engine } = await import('/src/engine/index.ts');
      const { catalog } = await import('/src/data/index.ts');
      const { referenceDesigns } = await import('/src/engine/reference-designs.ts');
      const mro = referenceDesigns(catalog).find((d) => d.id === 'mro-like').design;
      const base = engine.defaultDesign(catalog, 'mars-climate');
      const g = __game.getState();
      g.startScenario('mars-climate');
      g.updateDesign({ ...mro, missionName: 'Aquifer', parts: { ...mro.parts, transmitter: base.parts.transmitter } });
      g.setDesignTab('transmitter');
      g.go('design');
      await new Promise((r) => setTimeout(r, 1600));
      __game.getState().updateDesign({ parts: { ...mro.parts } });
      await new Promise((r) => setTimeout(r, 900));
    `);
    await shot('design-studio');

    // 2. Launch: the guided Jupiter demo, switched to the Earth gravity assist.
    await run(send, `
      const { JUPITER_ASSIST_ROUTE } = await import('/src/data/jupiter-demo.ts');
      __game.getState().startJupiterDemo();
      await new Promise((r) => setTimeout(r, 1600));
      __game.getState().updateDesign({ trajectoryId: JUPITER_ASSIST_ROUTE });
      await new Promise((r) => setTimeout(r, 900));
    `);
    await shot('launch-routes');

    // 3. Review board, once the 50 predicted flights are in.
    await run(send, `__game.getState().go('review'); await new Promise((r) => setTimeout(r, 5000));`);
    await shot('review-board');

    // 4. Flight: answer every card with its default; keep a picture of each card and of its real story.
    await run(send, `
      __game.getState().go('growth'); await new Promise((r) => setTimeout(r, 300));
      __game.getState().go('flight'); await new Promise((r) => setTimeout(r, 800));
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Launch').click();
    `);
    let lastCard = 'card';
    for (let i = 0; i < 400; i++) {
      await sleep(500);
      const state = await run(send, `
        const dialog = document.querySelector('[role=dialog]');
        const done = [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Read the debrief');
        return { card: dialog?.getAttribute('aria-label') ?? null, story: !!dialog && [...dialog.querySelectorAll('button')].some((b) => b.textContent.includes('Resume the mission')), done };
      `);
      if (state.done) break;
      if (!state.card) continue;
      await sleep(700); // let the card finish animating in
      const slug = state.card.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (state.story) {
        await shot(`story-${lastCard}`);
        await run(send, `[...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.includes('Resume the mission')).click();`);
      } else {
        lastCard = slug;
        await shot(`card-${slug}`);
        await run(send, `
          const { catalog } = await import('/src/data/index.ts');
          const title = document.querySelector('[role=dialog]').getAttribute('aria-label');
          const card = catalog.events.find((e) => e.title === title);
          const label = card.options.find((o) => o.id === card.defaultOptionId).label;
          [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.includes(label)).click();
        `);
      }
    }

    // 5. Debrief: the verdict, then Hindsight.
    await run(send, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Read the debrief').click(); await new Promise((r) => setTimeout(r, 9000));`);
    await shot('debrief');
    await run(send, `
      const ol = [...document.querySelectorAll('ol')].find((o) => o.className.includes('grid'));
      ol.closest('section').scrollIntoView({ block: 'start' });
      await new Promise((r) => setTimeout(r, 1500));
    `);
    await shot('hindsight');
  } finally {
    await close();
  }
}

async function pdf() {
  const { send, close } = await launch();
  try {
    await send('Page.navigate', { url: pathToFileURL(join(HERE, 'index.html')).href });
    await sleep(2500);
    await run(send, `await document.fonts.ready;`);
    // 1456 x 818 px slides at 96 px per inch, the size of the original deck.
    const { data } = await send('Page.printToPDF', { printBackground: true, paperWidth: 1456 / 96, paperHeight: 818 / 96, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, preferCSSPageSize: true });
    writeFileSync(PDF, Buffer.from(data, 'base64'));
    console.log('pdf', PDF);
  } finally {
    await close();
  }
}

if (!process.argv.includes('--pdf-only')) await screenshots();
if (!process.argv.includes('--shots-only')) await pdf();
