// Template for slides with text and pictures ("who did this before", and anything like it).
//
// Two layouts, switched from the presenter:
//   overview  the text in the middle of the front, pictures on screens either side
//   carousel  title on top, ONE big picture at the front, the others waiting on a ring around
//             the room. "Next picture" (button, ↓ key, or a click on the presenter preview)
//             turns the ring and brings the next one to the front.
// Pressing Next picture while in the overview switches to the carousel by itself.
//
// Media: put files in slides/<id>/media/ with the names listed in `images`.
// Stills (.jpg .png .webp), animated GIFs (.gif) and videos (.mp4 .webm, muted, looping) all work.
// Until a file exists a placeholder card shows the name it is waiting for.
import { ACT2, C, NOISE_GLSL } from './_common.js';
import { FONT } from '../lib/anglecanvas.js';
import { loadMedia, mediaKind, followClock } from '../lib/media.js';
import { DOME, rimElevation } from '../lib/dome.js';

const MAX = 6;
// A card of width w is assumed about w * 0.72 tall (the captions sit under it at the same spacing).
// Below a card: half its height, then the caption (2.2°) and the credit (1.9° more); keep the credit 2.5° above the rim.
const UNDER = (w) => w * 0.36 + 2.2 + 1.9 + 2.5;
/** overview: az, width (deg), and the elevation: around the sweet spot at the sides, lifted where the picture starts higher */
const slot = (az, w) => ({ az, w, el: Math.max(DOME.sweetSpot + 4, rimElevation(az) + UNDER(w)) });
const SLOTS = [slot(-76, 34), slot(76, 34), slot(-118, 30), slot(118, 30), slot(-155, 26), slot(155, 26)];
// carousel: the picture at the front centred just above the sweet spot; the waiting ones on the ring, lifted above the rim
const FEATURE = { el: DOME.sweetSpot + 3, w: 54 }, SIDE = { el: DOME.sweetSpot, w: 28 };
const sideEl = (az) => Math.max(SIDE.el, rimElevation(az) + SIDE.w * 0.36 + 2);

function placeholder(THREE, name, caption) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 640;
  const g = cv.getContext('2d');
  g.fillStyle = '#12151b'; g.fillRect(0, 0, 1024, 640);
  g.strokeStyle = 'rgba(255,181,71,.6)'; g.setLineDash([18, 14]); g.lineWidth = 6; g.strokeRect(12, 12, 1000, 616);
  g.fillStyle = '#a9adb6'; g.textAlign = 'center';
  const kind = mediaKind(name);
  g.font = `600 44px ${FONT}`; g.fillText(kind === 'video' ? 'video goes here' : kind === 'gif' ? 'animated GIF goes here' : 'picture goes here', 512, 270);
  g.font = `400 34px ${FONT}`; g.fillText(`media/${name}`, 512, 340);
  if (caption) { g.font = `400 28px ${FONT}`; g.fillStyle = '#6f747c'; g.fillText(caption.slice(0, 60), 512, 410); }
  const t = new THREE.CanvasTexture(cv); t.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex: t, aspect: 1024 / 640 };
}

const lerp = (a, b, t) => a + (b - a) * t;

/** where every card is: the same maths on the picture page and the sound page */
class Layout {
  constructor(n, startCarousel) { this.N = n; this.blend = startCarousel ? 1 : 0; this.curF = 0; this.spacing = n <= 1 ? 0 : Math.max(48, Math.min(64, 360 / n)); }
  step(view, dt) {
    const N = this.N;
    const pressT = Math.max(view.lastPress('next'), view.lastPress('prev'));
    const carousel = N > 0 && (view.p('view') === 'carousel' || pressT > view.lastSet('view'));
    const target = N ? (((view.count('next') - view.count('prev')) % N) + N) % N : 0;
    this.blend += ((carousel ? 1 : 0) - this.blend) * Math.min(1, dt * 3.5);
    let d = target - this.curF; if (N) d = ((d % N) + N * 1.5) % N - N / 2;
    this.curF += d * Math.min(1, dt * 3.2);
    this.front = N ? ((Math.round(this.curF) % N) + N) % N : 0;
  }
  place(i) {
    const N = this.N, s = SLOTS[i], b = this.blend;
    let k = i - this.curF; k = ((k % N) + N * 1.5) % N - N / 2;
    const f = Math.max(0, 1 - Math.abs(k));
    const cAz = k * this.spacing, cDim = Math.abs(cAz) > 172 ? 0 : lerp(0.42, 1, f);
    return { f: f * b, az: lerp(s.az, cAz, b), el: lerp(s.el, lerp(sideEl(cAz), FEATURE.el, f), b), w: lerp(s.w, lerp(SIDE.w, FEATURE.w, f), b), dim: lerp(1, cDim, b) };
  }
}

/**
 * makeRef({ title, year, name, who, facts: [..], images: [{ file, caption, credit }], notes, accent, extra, layout })
 * credit: a short line shown small under the caption (photographer, ©, collection)
 * extra(THREE, scene) -> { update(t) } for a small 3D homage (optional)
 * layout: 'overview' (default) or 'carousel' to start in the carousel
 */
export function makeRef(cfg) {
  const images = (cfg.images || []).slice(0, MAX);
  const hasPics = images.length > 0;
  return {
    title: cfg.title,
    act: cfg.act || ACT2,
    notes: (cfg.notes || '') + (images.some((im) => im.credit) ? `<p class="hint">Picture credits: ${images.filter((im) => im.credit).map((im) => `${im.file}: ${im.credit}`).join(' · ')}</p>` : '') + (hasPics ? `<p class="hint">Pictures: <b>↓</b> / click the preview = next, <b>↑</b> / shift-click = previous.</p>` : ''),
    params: {
      ...(hasPics ? {
        next: { type: 'button', label: 'Next picture ▶', hint: '↓ key, or click the preview' },
        prev: { type: 'button', label: '◀ Previous picture', hint: '↑ key, or shift-click the preview' },
        view: { type: 'select', label: 'Layout', options: [{ value: 'overview', label: 'Overview' }, { value: 'carousel', label: 'Carousel' }], value: cfg.layout || 'overview' },
      } : {}),
      ...Object.fromEntries(images.map((im, i) => [im, i]).filter(([im]) => mediaKind(im.file) === 'video')
        .map(([im, i]) => [`snd${i}`, { type: 'toggle', label: `🔊 Sound: ${im.caption || im.file}`, value: false }])),
      ...(images.some((im) => mediaKind(im.file) === 'video') ? { vol: { type: 'range', label: 'Video volume', min: 0, max: 1.5, step: 0.05, value: 1 } } : {}),
      text: { type: 'toggle', label: 'Text', value: true },
      ...(cfg.params || {}),
    },
    video({ THREE, comp, AngleCanvas, view, base, QUALITY }) {
      const accent = cfg.accent || C.warm;
      // overview text
      const acO = new AngleCanvas();
      // the text block runs from the top of the comfortable zone down past the sweet spot
      const T = DOME.sweetSpot + 17;
      acO.text(cfg.year, 0, T, { size: 4.6, weight: 800, color: accent, letter: 0.3 })
        .text(cfg.name, 0, T - 7.5, { size: 3, weight: 700, color: C.ink });
      if (cfg.who) acO.text(cfg.who, 0, T - 12.5, { size: 1.5, weight: 500, color: C.mute });
      acO.lines(cfg.facts || [], 0, T - 17.5, { size: 1.4, gap: 1.95, weight: 450, color: '#dcdfe4' });
      images.forEach((im, i) => {
        const s = SLOTS[i], y = s.el - s.w * 0.36 - 2.2;
        if (im.caption) acO.text(im.caption, s.az, y, { size: 1.1, color: C.mute, weight: 500 });
        if (im.credit) acO.text(im.credit, s.az, y - 1.9, { size: 0.75, color: '#7d828c', weight: 400 });
      });
      acO.commit();
      // carousel text (title on top + the caption of the picture at the front)
      const acC = new AngleCanvas();
      let captionFor = null;
      const drawCarouselText = (i, h) => {
        captionFor = `${i}:${h.toFixed(1)}`;
        // title just above the picture at the front, caption and credit just under it
        const top = FEATURE.el + h / 2;
        acC.clear()
          .text(`${cfg.year}  ·  ${cfg.name}`, 0, top + 7.5, { size: 2.6, weight: 750, color: C.ink })
          .text(cfg.who || '', 0, top + 3.2, { size: 1.3, weight: 500, color: C.mute });
        const im = images[i];
        if (im) acC.text(`${im.caption || ''}   ${i + 1} / ${images.length}`, 0, FEATURE.el - h / 2 - 2.0, { size: 1.35, weight: 550, color: accent });
        if (im?.credit) acC.text(im.credit, 0, FEATURE.el - h / 2 - 3.8, { size: 0.85, weight: 400, color: '#8d929b' });
        acC.commit();
      };

      // media
      const items = images.map((im) => {
        const ph = placeholder(THREE, im.file, im.caption);
        const it = { im, ph, tex: ph.tex, aspect: ph.aspect, media: null };
        it.media = loadMedia(base + 'media/' + im.file, { onReady: (m) => { it.tex = m.tex; it.aspect = m.aspect; captionFor = null; } });
        return it;
      });

      // optional 3D homage, through a cube map
      let cube = null, scene = null, extra = null;
      if (cfg.extra) { scene = new THREE.Scene(); cube = comp.cube(Math.min(1024, QUALITY.cube)); extra = cfg.extra(THREE, scene); }

      const empty = new THREE.DataTexture(new Uint8Array(4), 1, 1); empty.needsUpdate = true;
      const uni = {
        uEq: { value: acO.texture }, uEq2: { value: acC.texture }, uTextA: { value: 1 }, uTextB: { value: 0 },
        uCube: { value: cube ? cube.texture : comp.emptyCube }, uCubeOn: { value: cube ? 1 : 0 },
        uC: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },
        uD: { value: new Array(MAX).fill(0) },
      };
      for (let i = 0; i < MAX; i++) uni['uT' + i] = { value: empty };
      const cardCode = Array.from({ length: MAX }, (_, i) => `c = drawCard(uT${i}, uC[${i}], uD[${i}], room, c);`).join('\n');
      const mat = comp.material(`${NOISE_GLSL}
        uniform sampler2D uEq2; uniform float uTextA, uTextB;
        uniform sampler2D ${Array.from({ length: MAX }, (_, i) => 'uT' + i).join(', ')};
        uniform vec4 uC[${MAX}]; uniform float uD[${MAX}];
        vec3 drawCard(sampler2D t, vec4 cd, float d, vec3 room, vec3 c){
          if (d <= 0.0) return c;
          vec2 uv = cardUV(room, dirRoom(cd.x, cd.y), cd.z, cd.w, 0.0);
          if (uv.x < 0.0) return c;
          vec3 col = texture(t, uv).rgb * d;
          vec2 e = min(uv, 1.0 - uv) * vec2(cd.z, cd.z / cd.w);
          float edge = 1.0 - smoothstep(0.08, 0.16, min(e.x, e.y));
          return mix(col, vec3(0.55) * d, edge * 0.6);
        }
        vec4 slideColor(vec3 room, vec3 local, vec2 m){
          vec3 c = houseSky(room, 0.8) + stars(room) * 0.25;
          if (uCubeOn > 0.5) { vec4 p = texture(uCube, toThree(room)); c = mix(c, p.rgb, p.a); }
          ${cardCode}
          vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a * uTextA);
          vec4 e2 = sampleEq(uEq2, room); c = mix(c, e2.rgb, e2.a * uTextB);
          return vec4(c, 1.0);
        }`, uni);

      const N = items.length;
      const lay = new Layout(N, cfg.layout === 'carousel');
      return {
        render(t, dt) {
          lay.step(view, dt);
          const front = lay.front, blend = lay.blend;
          const placed = items.map((it, i) => ({ it, ...lay.place(i) })).sort((a, b) => a.f - b.f); // front picture last
          placed.forEach((p, j) => {
            p.it.media?.update();
            p.it.media?.follow?.(view.t());
            uni['uT' + j].value = p.it.tex;
            uni.uC.value[j].set(p.az, p.el, p.w, p.it.aspect);
            uni.uD.value[j] = p.dim;
          });
          for (let j = placed.length; j < MAX; j++) uni.uD.value[j] = 0;

          const fh = N ? FEATURE.w / items[front].aspect : 0;
          if (captionFor !== `${front}:${fh.toFixed(1)}`) drawCarouselText(front, fh);
          const textOn = view.p('text') ? 1 : 0;
          uni.uTextA.value = textOn * (1 - blend);
          uni.uTextB.value = textOn * blend;

          if (extra) { extra.update(view.t()); const r = comp.renderer; const cc = r.getClearAlpha(); r.setClearColor(0x000000, 0); cube.render(scene); r.setClearColor(0x000000, cc); }
          return mat;
        },
        dispose() {
          mat.dispose(); acO.dispose(); acC.dispose(); empty.dispose(); cube?.dispose(); extra?.dispose?.();
          items.forEach((it) => { it.ph.tex.dispose(); it.media?.dispose(); });
        },
      };
    },
    audio(ctx) {
      const own = cfg.audio ? cfg.audio(ctx) : null;
      const vids = images.map((im, i) => ({ im, i })).filter(({ im }) => mediaKind(im.file) === 'video');
      if (!vids.length) return own;
      const { group, view, base, ctx: ac } = ctx;
      const lay = new Layout(images.length, cfg.layout === 'carousel');
      const players = {};
      const open = (i, file) => {
        const v = document.createElement('video');
        v.preload = 'auto'; v.loop = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.src = base + 'media/' + file;
        const src = ac.createMediaElementSource(v);
        const gain = ac.createGain(); gain.gain.value = 0;
        const pan = group.panner();
        src.connect(gain).connect(pan.input);
        return { v, src, gain, pan };
      };
      let last = performance.now();
      return {
        update(t) {
          const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
          lay.step(view, dt);
          const vol = view.p('vol') ?? 1;
          for (const { im, i } of vids) {
            const on = !!view.p(`snd${i}`);
            let pl = players[i];
            if (on && !pl) pl = players[i] = open(i, im.file);
            if (!pl) continue;
            const pos = lay.place(i);
            if (on) followClock(pl.v, view.t()); else if (!pl.v.paused && pl.gain.gain.value < 0.001) pl.v.pause();
            // louder at the front of the carousel, quieter on the ring; placed where the picture is
            const g = on ? vol * (0.35 + 0.65 * Math.max(pos.f, 1 - lay.blend)) * (pos.dim > 0 ? 1 : 0) : 0;
            pl.gain.gain.setTargetAtTime(g, ac.currentTime, 0.12);
            pl.pan.set(pos.az, pos.el, 0, 0.05);
          }
          own?.update?.(t);
        },
        dispose() {
          for (const pl of Object.values(players)) { pl.v.pause(); pl.v.removeAttribute('src'); pl.v.load(); pl.src.disconnect(); }
          own?.dispose?.();
        },
      };
    },
  };
}
