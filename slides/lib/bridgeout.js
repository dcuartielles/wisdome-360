// Sends the dome mix to the UNO Q audio bridge (live/bridge/rx/domebridge_rx.py) over a WebSocket.
// The AudioWorklet (bridge-worklet.js) hands 10 ms blocks straight to a Worker
// (bridge-net-worker.js) that owns the socket, so the page's main thread is never in the path.
// Reconnects by itself; the bridge answers with a JSON status line every second.
export class BridgeOut {
  constructor(ctx, source, { channels = 6, frames = 480 } = {}) {
    this.ctx = ctx; this.source = source; this.channels = channels; this.frames = frames;
    this.host = null; this.port = 9300;
    this.sent = 0; this.dropped = 0; this.link = 'off'; this.remote = null;
    this.node = null; this.worker = null; this.wanted = false;
  }
  async start(host, port = 9300) {
    this.host = host; this.port = port; this.wanted = true;
    if (!this.node) {
      await this.ctx.audioWorklet.addModule(new URL('./bridge-worklet.js', import.meta.url));
      this.node = new AudioWorkletNode(this.ctx, 'bridge-tap', {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
        channelCount: this.channels, channelCountMode: 'explicit', channelInterpretation: 'discrete',
        processorOptions: { channels: this.channels, frames: this.frames },
      });
      this.worker = new Worker(new URL('./bridge-net-worker.js', import.meta.url));
      this.worker.onmessage = (e) => Object.assign(this, e.data);   // link, sent, dropped, remote
      const pipe = new MessageChannel();   // worklet → worker, bypassing this thread
      this.node.port.postMessage({ sink: pipe.port1 }, [pipe.port1]);
      this.worker.postMessage({ audio: pipe.port2, rate: this.ctx.sampleRate, channels: this.channels }, [pipe.port2]);
      this.source.connect(this.node);
      const hush = this.ctx.createGain(); hush.gain.value = 0;   // keeps the worklet pulled by the graph
      this.node.connect(hush).connect(this.ctx.destination);
    }
    this.node.port.postMessage({ on: true });
    this.worker.postMessage({ cmd: 'start', host, port });
    this.link = 'connecting';
  }
  stop() {
    this.wanted = false;
    this.node?.port.postMessage({ on: false });
    this.worker?.postMessage({ cmd: 'stop' });
    this.link = 'off';
  }
  setHost(host, port = this.port) {
    this.host = host; this.port = port;
    if (this.wanted) this.worker.postMessage({ cmd: 'start', host, port });
  }
  /** what the audio page and the presenter show */
  status() {
    const r = this.remote;
    return { link: this.link, host: this.host, sent: this.sent, dropped: this.dropped,
      state: r?.state ?? null, fill_ms: r?.fill_ms ?? null, ppm: r?.ppm ?? null, underruns: r?.underruns ?? null,
      muted: r?.muted ?? null, sink_error: r?.sink_error ?? null, name: r?.name ?? null };
  }
}
