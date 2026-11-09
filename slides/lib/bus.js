// Connection to the local server: shared state, a synced clock, commands and data streams.
const ID = Math.random().toString(36).slice(2, 8);

export function connect(role) {
  const listeners = {};
  const bus = {
    id: ID, role, state: null, stats: {}, offset: 0, connected: false,
    on(type, fn) { (listeners[type] ||= []).push(fn); return () => { listeners[type] = listeners[type].filter((f) => f !== fn); }; },
    emit(type, data) { (listeners[type] || []).forEach((f) => f(data)); },
    /** server time in seconds */
    now() { return (performance.timeOrigin + performance.now() + bus.offset) / 1000; },
    cmd(obj) {
      return fetch('/cmd', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj), keepalive: true }).catch(() => {});
    },
    /** high-rate data to other pages (and to listeners in this page, at once) */
    stream(name, data) {
      bus.emit('stream', { name, data, from: ID, local: true });
      bus.cmd({ type: 'stream', name, data, from: ID });
    },
  };

  const es = new EventSource(`/events?role=${encodeURIComponent(role)}`);
  es.addEventListener('hello', () => { bus.connected = true; bus.emit('connected', true); syncClock(); });
  es.addEventListener('state', (e) => { bus.state = JSON.parse(e.data); bus.emit('state', bus.state); });
  es.addEventListener('stats', (e) => { bus.stats = JSON.parse(e.data); bus.emit('stats', bus.stats); });
  es.addEventListener('stream', (e) => { const m = JSON.parse(e.data); if (m.from !== ID) bus.emit('stream', m); });
  es.onerror = () => { bus.connected = false; bus.emit('connected', false); };

  // clock sync: keep the sample with the smallest round trip
  async function syncClock() {
    let best = null;
    for (let i = 0; i < 6; i++) {
      const t0 = performance.timeOrigin + performance.now();
      try {
        const { t } = await (await fetch('/time', { cache: 'no-store' })).json();
        const t1 = performance.timeOrigin + performance.now();
        const rtt = t1 - t0;
        if (!best || rtt < best.rtt) best = { rtt, offset: t - (t0 + t1) / 2 };
      } catch { /* offline */ }
    }
    if (best) bus.offset = best.offset;
  }
  setInterval(syncClock, 20000);
  return bus;
}

/** Everything a slide needs to read the shared state, identical on the video and audio pages. */
export function slideView(bus, slide) {
  const defaults = {};
  for (const [k, p] of Object.entries(slide.params || {})) defaults[k] = p.value;
  const st = () => bus.state || { params: {}, log: [], startedAt: Date.now() };
  return {
    /** current value of a parameter */
    p(key) { const v = st().params[key]; return v === undefined ? defaults[key] : v; },
    /** seconds since the slide started */
    t() { return bus.now() - st().startedAt / 1000; },
    /** ∫ param(key) dt from the slide start to now — e.g. an angle from a speed. Exact on every page. */
    integrate(key, scale = 1, at = bus.now()) {
      const s = st();
      let t = s.startedAt / 1000, rate = defaults[key] ?? 0, acc = 0;
      for (const e of s.log) {
        if (e.key !== key) continue;
        const et = e.at / 1000;
        if (et > at) break;
        acc += rate * (et - t); t = et; rate = Number(e.value);
      }
      return (acc + rate * (at - t)) * scale;
    },
    /** times (server seconds) of button presses */
    presses(key) { return st().log.filter((e) => e.key === key && e.value === 'press').map((e) => e.at / 1000); },
    lastPress(key) { const p = this.presses(key); return p.length ? p[p.length - 1] : -Infinity; },
    /** server time (s) of the last change to a param, or -Infinity */
    lastSet(key) { const l = st().log; for (let i = l.length - 1; i >= 0; i--) if (l[i].key === key && l[i].value !== 'press') return l[i].at / 1000; return -Infinity; },
    /** every value set for key (e.g. clicks on the dome), in order: [{ at (server s), value }] */
    events(key) { return st().log.filter((e) => e.key === key && e.value !== 'press').map((e) => ({ at: e.at / 1000, value: e.value })); },
    /** number of presses of a button */
    count(key) { return st().log.filter((e) => e.key === key && e.value === 'press').length; },
    global(key) { return st().global?.[key]; },
    now: () => bus.now(),
  };
}
