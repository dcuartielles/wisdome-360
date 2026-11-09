// Pictures, videos and animated GIFs as three.js textures.
//   .jpg .png .webp      still picture
//   .gif                 animated (decoded frame by frame with ImageDecoder; first frame as a fallback)
//   .mp4 .webm .mov      video, muted, looping
// loadMedia() returns at once; `tex`/`aspect` change when the file has loaded (onReady fires).
import * as THREE from '../vendor/three.module.min.js';

const VIDEO = /\.(mp4|webm|mov|m4v)$/i;
const GIF = /\.gif$/i;

export function followClock(v, sec) {
  const d = v.duration;
  if (!d || !isFinite(d)) return;
  const target = ((sec % d) + d) % d;
  let diff = v.currentTime - target;
  if (diff > d / 2) diff -= d; else if (diff < -d / 2) diff += d;
  if (Math.abs(diff) > 0.25) v.currentTime = target;
  if (v.paused) v.play().catch(() => {});
}

export function mediaKind(file) { return VIDEO.test(file) ? 'video' : GIF.test(file) ? 'gif' : 'image'; }

export function loadMedia(url, { onReady } = {}) {
  const m = { url, kind: mediaKind(url), tex: null, aspect: 16 / 10, ok: false, animated: false, update() {}, dispose() {} };
  const ready = () => { m.ok = true; onReady?.(m); };

  if (m.kind === 'video') {
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
    v.addEventListener('loadeddata', () => {
      const t = new THREE.VideoTexture(v);
      t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
      m.tex = t; m.aspect = v.videoWidth / v.videoHeight || 16 / 9; m.animated = true;
      v.play().catch(() => {});
      ready();
    }, { once: true });
    v.src = url;
    m.video = v;
    /** keep the video at (seconds since an anchor) mod its length, so every page shows the same frame */
    m.follow = (sec) => followClock(v, sec);
    m.dispose = () => { v.pause(); v.removeAttribute('src'); v.load(); m.tex?.dispose(); };
    return m;
  }

  if (m.kind === 'gif' && 'ImageDecoder' in window) {
    (async () => {
      try {
        const res = await fetch(url); if (!res.ok) throw new Error(res.status);
        const dec = new ImageDecoder({ data: await res.arrayBuffer(), type: 'image/gif' });
        await dec.tracks.ready;
        const n = dec.tracks.selectedTrack.frameCount;
        const frames = [];
        for (let i = 0; i < n; i++) {
          const { image } = await dec.decode({ frameIndex: i });
          frames.push({ bmp: await createImageBitmap(image), dur: Math.max(20, (image.duration || 100000) / 1000) });
          image.close();
        }
        dec.close();
        const cv = document.createElement('canvas');
        cv.width = frames[0].bmp.width; cv.height = frames[0].bmp.height;
        const g = cv.getContext('2d');
        const total = frames.reduce((a, f) => a + f.dur, 0);
        let shown = -1;
        const t = new THREE.CanvasTexture(cv); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
        m.tex = t; m.aspect = cv.width / cv.height; m.animated = frames.length > 1;
        m.update = () => {
          let ms = performance.now() % total, i = 0;
          while (ms > frames[i].dur && i < frames.length - 1) { ms -= frames[i].dur; i++; }
          if (i !== shown) { shown = i; g.clearRect(0, 0, cv.width, cv.height); g.drawImage(frames[i].bmp, 0, 0); t.needsUpdate = true; }
        };
        m.update();
        m.dispose = () => { frames.forEach((f) => f.bmp.close()); t.dispose(); };
        ready();
      } catch (e) { loadStill(); }
    })();
    return m;
  }

  function loadStill() {
    const img = new Image();
    img.onload = () => {
      const t = new THREE.Texture(img);
      t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8; t.needsUpdate = true;
      m.tex = t; m.aspect = img.width / img.height;
      m.dispose = () => t.dispose();
      ready();
    };
    img.src = url;
  }
  loadStill();
  return m;
}
