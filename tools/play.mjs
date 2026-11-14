// Drives the game in headless Chrome over the DevTools protocol: real key presses,
// waits on game state, screenshots and evaluations. Run with tools/node.sh.
// Usage: node tools/play.mjs <plan.json> [outdir]   plan: { "url": "...", "steps": [...] }
// (the URL lives in the file because cmd.exe would split it at '&').
// Steps: {wait:ms} {down:'KeyD'} {up:'KeyD'} {tap:'KeyJ', ms:60} {shot:'name'}
//        {eval:'js', label} {until:'js', timeout:ms}
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const [planFile, outDir = 'shots'] = process.argv.slice(2);
const { url, steps } = JSON.parse(readFileSync(planFile, 'utf8'));
mkdirSync(outDir, { recursive: true });
const port = 9400 + Math.floor(Math.random() * 400);
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=C:\\Users\\Public\\pb_runs\\cdp_${port}`,
  '--window-size=1280,720', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let tabs = null;
for (let i = 0; i < 50 && !tabs; i++) { await sleep(200); try { tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch {} }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) console.log('console.' + d.params.type, d.params.args.map((a) => a.value ?? a.description).join(' '));
  if (d.method === 'Runtime.exceptionThrown') console.log('EXCEPTION', d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;
await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url });
await sleep(1500);
const keyEv = (type, code) => send('Input.dispatchKeyEvent', { type, code, key: code.replace(/^Key/, '').toLowerCase(), windowsVirtualKeyCode: code.startsWith('Key') ? code.charCodeAt(3) : code === 'Space' ? 32 : 0 });
const t0 = Date.now();
for (const s of steps) {
  if (s.wait) await sleep(s.wait);
  if (s.down) for (const c of [].concat(s.down)) await keyEv('keyDown', c);
  if (s.up) for (const c of [].concat(s.up)) await keyEv('keyUp', c);
  if (s.tap) { for (const c of [].concat(s.tap)) await keyEv('keyDown', c); await sleep(s.ms ?? 70); for (const c of [].concat(s.tap)) await keyEv('keyUp', c); }
  if (s.until) {
    const end = Date.now() + (s.timeout ?? 20000);
    while (Date.now() < end && !(await evaluate(s.until))) await sleep(100);
  }
  if (s.eval) console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s.label ?? s.eval}:`, JSON.stringify(await evaluate(s.eval)));
  if (s.shot) {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${outDir}/${s.shot}.png`, Buffer.from(r.result.data, 'base64'));
  }
}
ws.close();
proc.kill();
