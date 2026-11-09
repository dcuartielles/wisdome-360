// Worker: owns the WebSocket to the UNO Q audio bridge (live/bridge/rx/domebridge_rx.py).
// Blocks come straight from the AudioWorklet over a MessagePort, so a busy page main thread
// (the 2048² picture page shares Chrome's renderer process) can't delay them: on the real
// laptop that caused gaps of up to 150 ms and constant underruns on the bridge.
// Block format, little-endian: 'DBR1' · u32 seq · u32 sampleRate · u16 channels · u16 frames,
// then frames × channels float32, interleaved L R C LFE Ls Rs.
let ws = null, host = null, port = 9300, rate = 48000, channels = 6;
let seq = 0, sent = 0, dropped = 0, link = 'off', wanted = false, retry = null;
let remote = null, remoteAt = 0;
// diagnostics, sent to the bridge once a second: longest pause between blocks from the worklet,
// and the most that sat unsent in the socket (tells a starved audio thread from a stuck network)
let lastBlock = 0, gapMax = 0, bufMax = 0, blocksIn = 0;

function open() {
  clearTimeout(retry);
  try { ws = new WebSocket(`ws://${host}:${port}/`); }
  catch (e) { ws = null; link = 'bad address'; retry = setTimeout(open, 2000); return; }
  const me = ws;
  me.binaryType = 'arraybuffer';
  link = 'connecting'; seq = 0;
  me.onopen = () => { link = 'connected'; me.send(JSON.stringify({ hello: 'dome-audio', rate, channels, via: 'worker' })); };
  me.onmessage = (e) => { if (typeof e.data === 'string') { try { remote = JSON.parse(e.data); remoteAt = performance.now(); } catch {} } };
  me.onerror = () => {};
  me.onclose = () => { if (ws !== me) return; ws = null; link = 'reconnecting'; if (wanted) retry = setTimeout(open, 2000); };
}
function close() {
  clearTimeout(retry);
  if (ws) { const old = ws; ws = null; old.onclose = null; old.close(); }
}
function send(block) {
  const now = performance.now();
  if (lastBlock) gapMax = Math.max(gapMax, now - lastBlock);
  lastBlock = now; blocksIn++;
  if (!ws || ws.readyState !== 1) return;
  bufMax = Math.max(bufMax, ws.bufferedAmount);
  if (ws.bufferedAmount > 256 * 1024) { dropped++; return; }   // network stuck: don't pile up latency
  const frames = block.length / channels;
  const out = new ArrayBuffer(16 + block.byteLength);
  const dv = new DataView(out);
  dv.setUint8(0, 0x44); dv.setUint8(1, 0x42); dv.setUint8(2, 0x52); dv.setUint8(3, 0x31);   // 'DBR1'
  dv.setUint32(4, seq >>> 0, true);
  dv.setUint32(8, rate, true);
  dv.setUint16(12, channels, true);
  dv.setUint16(14, frames, true);
  new Float32Array(out, 16).set(block);
  ws.send(out);
  seq = (seq + 1) >>> 0; sent++;
}

self.onmessage = (e) => {
  const m = e.data;
  if (m.audio) m.audio.onmessage = (ev) => send(ev.data);   // the port from the worklet
  if ('rate' in m) rate = m.rate;
  if ('channels' in m) channels = m.channels;
  if (m.cmd === 'start') { host = m.host; port = m.port; wanted = true; close(); open(); }
  else if (m.cmd === 'stop') { wanted = false; close(); link = 'off'; }
};
// status for the page, twice a second
setInterval(() => {
  const r = remote && performance.now() - remoteAt < 3000 ? remote : null;
  self.postMessage({ link, sent, dropped, remote: r });
}, 500);
setInterval(() => {
  if (ws && ws.readyState === 1)
    ws.send(JSON.stringify({ diag: { blocks: blocksIn, gap_ms: Math.round(gapMax), buf_kb: Math.round(bufMax / 1024), dropped } }));
  gapMax = 0; bufMax = 0; blocksIn = 0;
}, 1000);
