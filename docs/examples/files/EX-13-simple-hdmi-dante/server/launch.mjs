// `node server/server.mjs --launch`: what the desktop icon runs.
// Opens OBS (if installed and not running) and Chrome windows (sound + launch console),
// using a Chrome profile of its own so the autoplay flag always applies.
// No PowerShell, no script host: security software leaves plain node.exe alone.
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const log = (...a) => console.log('[launch]', ...a);
const first = (list) => list.find((p) => p && fs.existsSync(p));

// is a program running? Asynchronous with a time limit: on some laptops `tasklist` takes 10-20 s
// (security software). Resolves true / false, or null if it could not tell in time.
function running(name, ms = 6000) {
  return new Promise((resolve) => {
    const win = process.platform === 'win32';
    const p = execFile(win ? 'tasklist' : 'pgrep', win ? ['/FI', `IMAGENAME eq ${name}`, '/NH'] : ['-x', name], { encoding: 'utf8', timeout: ms, windowsHide: true },
      (err, out) => {
        if (err && err.killed) return resolve(null);
        if (win) return resolve(!err && out.toLowerCase().includes(name.toLowerCase()));
        resolve(!err);
      });
    p.on('error', () => resolve(null));
  });
}
function start(file, args, cwd) {
  try {
    const p = spawn(file, args, { cwd, detached: true, stdio: 'ignore', windowsHide: false });
    p.on('error', (e) => log('could not start', file, e.message));
    p.unref();
    log('started', path.basename(file));
  } catch (e) { log('could not start', file, e.message); }
}

export function dataDir() {
  const base = process.platform === 'win32' ? (process.env.LOCALAPPDATA || os.homedir())
    : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.local', 'share');
  const d = path.join(base, 'DomeSlides');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function launch(port) {
  const win = process.platform === 'win32', mac = process.platform === 'darwin';
  const PF = process.env.ProgramFiles, PF86 = process.env['ProgramFiles(x86)'], LAD = process.env.LOCALAPPDATA;

  // Chrome (or Edge on Windows)
  const browser = win
    ? first([PF && path.join(PF, 'Google', 'Chrome', 'Application', 'chrome.exe'), PF86 && path.join(PF86, 'Google', 'Chrome', 'Application', 'chrome.exe'), LAD && path.join(LAD, 'Google', 'Chrome', 'Application', 'chrome.exe'), PF86 && path.join(PF86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), PF && path.join(PF, 'Microsoft', 'Edge', 'Application', 'msedge.exe')])
    : mac ? first(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']) : first(['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']);
  const url = (p) => `http://localhost:${port}${p}`;
  if (!browser) {
    log('Chrome not found: opening the default browser');
    if (win) start('cmd', ['/c', 'start', '', url('/launch/')]); else start(mac ? 'open' : 'xdg-open', [url('/launch/')]);
  }
  else {
  const common = [
    `--user-data-dir=${path.join(dataDir(), 'browser-profile')}`,
    '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--no-default-browser-check',
    '--disable-features=Translate,CalculateNativeWinOcclusion', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  ];
  // the console first (that's what you look at), the sound window a moment later
  start(browser, [...common, `--app=${url('/launch/')}`, '--start-maximized', '--window-position=0,0']);
  setTimeout(() => start(browser, [...common, `--app=${url('/audio/?autostart=1')}`, '--window-position=60,60', '--window-size=780,640']), 1500);
  log('Chrome is starting: the console appears in a few seconds');
  }

  // OBS: picture → NDI
  const obsArgs = ['--profile', 'Dome slides', '--collection', 'Dome slides', '--scene', 'Dome', '--minimize-to-tray', '--disable-shutdown-check', '--disable-updater'];
  if (win) {
    const obs = first([PF && path.join(PF, 'obs-studio', 'bin', '64bit', 'obs64.exe'), PF86 && path.join(PF86, 'obs-studio', 'bin', '64bit', 'obs64.exe')]);
    if (!obs) log('OBS not found: skipping (the picture page can still be opened by hand)');
    else running('obs64.exe').then((r) => {
      if (r === true) log('OBS already running');
      else if (r === null) log('could not tell whether OBS is running (slow tasklist): start it by hand if it is not open');
      else start(obs, obsArgs, path.dirname(obs));
    });
  } else if (mac) {
    if (fs.existsSync('/Applications/OBS.app')) running('obs').then((r) => { if (r === false) start('open', ['-a', 'OBS', '--args', ...obsArgs.filter((a) => a !== '--minimize-to-tray')]); });
  }
}
