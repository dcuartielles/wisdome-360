// Dome slides — local server. No dependencies: Node 18+ only.
//   node server/server.mjs [--port 8360]
// Serves live/ as static files, ../outputs as /outputs, and one shared state:
//   GET  /events   Server-Sent Events: 'state', 'stream', 'stats'
//   POST /cmd      JSON commands (goto, set, press, global, delay, stream, stats)
//   GET  /time     server clock, for clock sync
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { launch } from './launch.mjs';

// everything the server prints also goes to server/last-run.log (overwritten each start), so a
// launch from the desktop icon can be checked afterwards
const LOGFILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'last-run.log');
try { fs.writeFileSync(LOGFILE, `start ${new Date().toISOString()}  node ${process.version}  argv ${process.argv.slice(2).join(' ')}  cwd ${process.cwd()}\n`); } catch {}
for (const k of ['log', 'error', 'warn']) {
  const orig = console[k].bind(console);
  console[k] = (...a) => { orig(...a); try { fs.appendFileSync(LOGFILE, a.map(String).join(' ') + '\n'); } catch {} };
}
process.on('uncaughtException', (e) => { console.error('UNCAUGHT', e?.stack || e); });
process.on('exit', (c) => { try { fs.appendFileSync(LOGFILE, `exit ${c} ${new Date().toISOString()}\n`); } catch {} });

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');                 // live/
const OUTPUTS = path.resolve(ROOT, '..', 'outputs');   // ../outputs (examples, videos)
const CONFIG = path.join(HERE, 'config.local.json');   // per machine: audio delay etc.
const argPort = process.argv.indexOf('--port');
const PORT = argPort > 0 ? Number(process.argv[argPort + 1]) : Number(process.env.PORT || 8360);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.glsl': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

let local = {};
try { local = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { /* first run */ }

const now = () => Date.now();
const state = {
  rev: 0,
  slide: 0,
  slideId: null,
  startedAt: now(),          // ms, server clock, when the current slide began
  params: {},                // current slide's parameters (only those changed from defaults)
  log: [],                   // [{at, key, value}] changes on the current slide (for exact replays)
  global: { blackout: false, guides: false, pip: false, mute: false },
  delayMs: local.delayMs ?? 0,
  hostname: os.hostname(),
};
const stats = {};            // role -> last stats message
const clients = new Set();

function send(res, event, data) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
function broadcast(event, data, except) { for (const c of clients) if (c !== except) send(c.res, event, data); }
function publish() { state.rev++; broadcast('state', state); }
function saveLocal() { try { fs.writeFileSync(CONFIG, JSON.stringify({ delayMs: state.delayMs }, null, 2)); } catch {} }

function handleCmd(m) {
  const at = now();
  switch (m.type) {
    case 'goto':
      state.slide = m.slide | 0; state.slideId = m.slideId ?? null;
      state.startedAt = at; state.params = {}; state.log = [];
      publish(); break;
    case 'restart':
      state.startedAt = at; state.params = {}; state.log = []; publish(); break;
    case 'set':
      state.params[m.key] = m.value; state.log.push({ at, key: m.key, value: m.value });
      if (state.log.length > 2000) state.log.splice(0, state.log.length - 2000);
      publish(); break;
    case 'press':  // a button: logged as an event with a time
      state.log.push({ at: at + (m.lead ?? 150), key: m.key, value: 'press' }); publish(); break;
    case 'global':
      state.global[m.key] = m.value; publish(); break;
    case 'delay':
      state.delayMs = Math.max(0, Math.min(1000, Number(m.ms) || 0)); saveLocal(); publish(); break;
    case 'stream': // high-rate data (mic spectrum…): relayed, not stored
      broadcast('stream', { name: m.name, data: m.data, from: m.from, at }); break;
    case 'stats':
      stats[m.role] = { ...m, at }; broadcast('stats', stats); break;
    case 'shutdown':
      broadcast('bye', {}); setTimeout(() => process.exit(0), 300); break;
    default: return false;
  }
  return true;
}

function serveFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;
    if (range) { // video seeking
      const [s, e] = range.replace('bytes=', '').split('-');
      const start = Number(s), end = e ? Number(e) : st.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (p === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const client = { res, role: url.searchParams.get('role') || '?' };
    clients.add(client);
    send(res, 'hello', { serverTime: now() });
    send(res, 'state', state);
    send(res, 'stats', stats);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => { clearInterval(ping); clients.delete(client); });
    return;
  }
  if (p === '/time') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ t: now() })); return; }
  if (p === '/cmd' && req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      let ok = false;
      try { ok = handleCmd(JSON.parse(body)); } catch {}
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok }));
    });
    return;
  }
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Headers': 'content-type' }); res.end(); return; }
  if (p === '/') { res.writeHead(302, { Location: '/presenter/' }); res.end(); return; }

  let base = ROOT, rel = p;
  if (p.startsWith('/outputs/')) { base = OUTPUTS; rel = p.slice('/outputs'.length); }
  let file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base)) { res.writeHead(403); res.end(); return; }
  if (p.endsWith('/')) file = path.join(file, 'index.html');
  serveFile(req, res, file);
});

const LAUNCH = process.argv.includes('--launch');
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is busy: the dome slides server is probably already running.`);
    if (LAUNCH) { launch(PORT); setTimeout(() => process.exit(0), 3000); return; }
  } else console.error(e);
  process.exit(1);
});
// no host given: listens on IPv4 and IPv6, so "localhost" works whichever way Windows resolves it
server.listen(PORT, () => {
  if (process.title !== undefined) process.title = 'Dome slides server';
  if (LAUNCH) { console.log('\n  Keep this window open (minimised is fine). Close it to stop the dome slides.'); launch(PORT); }
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`\nDome slides server on port ${PORT}`);
  console.log(`  presenter  http://localhost:${PORT}/presenter/`);
  console.log(`  video      http://localhost:${PORT}/video/        (OBS Browser Source, 2048 x 2048)`);
  console.log(`  audio      http://localhost:${PORT}/audio/        (Chrome tab → Dante / 5.1 device)`);
  console.log(`  rehearse   http://localhost:${PORT}/video/?audio=1&view=inside   (one tab, picture + sound)`);
  for (const ip of ips) console.log(`  on the LAN http://${ip}:${PORT}/presenter/`);
  console.log('');
});
