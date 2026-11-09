// Runs the sound half of each slide. Used by audio/ (the Dante tab) and by video/?audio=1 (rehearsal).
import { AudioEngine } from './audio51.js';
import { slideView } from './bus.js';

export class AudioHost {
  constructor(bus, slides, { reportStats = true } = {}) {
    this.bus = bus; this.slides = slides; this.reportStats = reportStats;
    this.ctx = null; this.engine = null; this.current = null; this.index = -1; this.startedAt = null;
  }
  async start(sinkId) {
    if (this.ctx) return;
    const opts = { latencyHint: 'interactive', sampleRate: 48000 };
    if (sinkId) opts.sinkId = sinkId;
    try { this.ctx = new AudioContext(opts); } catch { this.ctx = new AudioContext({ latencyHint: 'interactive' }); }
    await this.ctx.resume();
    this.engine = new AudioEngine(this.ctx);
    this.bus.on('state', () => this.sync());
    this.sync();
    this.timer = setInterval(() => this.tick(), 20);
    if (this.reportStats) this.statsTimer = setInterval(() => this.sendStats(), 250);
  }
  async setSink(id) {
    if (!this.ctx?.setSinkId) return false;
    await this.ctx.setSinkId(id || '');
    this.engine.configureDestination();
    return true;
  }
  /** AudioContext time for a server time (seconds) */
  ctxTime(serverSec) { return this.ctx.currentTime + (serverSec - this.bus.now()); }
  sync() {
    const s = this.bus.state; if (!s || !this.engine) return;
    this.engine.setDelay(s.delayMs || 0);
    this.engine.setMute(!!s.global?.mute || !!s.global?.blackout);
    if (s.slide !== this.index || s.startedAt !== this.startedAt) {
      this.index = s.slide; this.startedAt = s.startedAt;
      if (this.current) { try { this.current.part?.dispose?.(); } catch (e) { console.error(e); } this.current.group.dispose(); }
      this.current = null;
      const slide = this.slides[s.slide];
      if (slide?.audio) {
        const group = this.engine.group();
        const view = slideView(this.bus, slide);
        try {
          const base = new URL(`../slides/${slide.id}/`, import.meta.url).href;
          const part = slide.audio({ group, view, ctx: this.ctx, engine: this.engine, ctxTime: (t) => this.ctxTime(t), bus: this.bus, base });
          this.current = { group, part, view };
        } catch (e) { console.error('audio part failed', slide.id, e); this.current = { group, part: null }; }
      }
    }
  }
  tick() {
    if (!this.current?.part?.update) return;
    try { this.current.part.update(this.bus.now()); } catch (e) { console.error(e); }
  }
  sendStats() {
    const lv = this.engine.levels();
    this.lastLevels = lv;
    this.bus.cmd({ type: 'stats', role: 'audio', levels: lv.map((v) => +v.toFixed(4)), discrete: this.engine.discrete, channels: this.ctx.destination.channelCount, rate: this.ctx.sampleRate, baseLatency: this.ctx.baseLatency, outputLatency: this.ctx.outputLatency });
  }
}
