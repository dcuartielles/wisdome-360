// ─────────────────────────────────────────────────────────────────────────────────────────────
// simpleSlide(): the template behind slides/start-here/. It lets a slide be written in plain
// JavaScript: words, shapes and pictures placed by angle, something that moves, and one sound
// that follows it. No shader code. You don't need to change this file.
//
//   draw.text(words, az, el, { size, color, weight })   words centred on (az, el); size = letter height in °
//   draw.circle(az, el, size, { color, glow })          a round spot, size = diameter in °
//   draw.box(az, el, width, height, { color, fill })     a rectangle, sizes in °
//   draw.picture(file, az, el, width)                    a picture from the slide's media/ folder
//
// Angles: az (azimuth) 0 = straight ahead, 90 = right, -90 = left, 180 = behind.
//         el (elevation) 0 = eye level, 90 = straight up. dome.sweetSpot ≈ 20 is the best place.
// ─────────────────────────────────────────────────────────────────────────────────────────────
import { NOISE_GLSL, C, ACT_SHOW } from './_common.js';
import { DOME, rimElevation } from '../lib/dome.js';
import { FONT } from '../lib/anglecanvas.js';

export { C, ACT_SHOW };

const D = Math.PI / 180;

/** the drawing commands a slide uses; one Draw per canvas */
class Draw {
  constructor(ac, base, onPictureLoaded) {
    this.ac = ac; this.base = base; this.onPictureLoaded = onPictureLoaded;
    this.pictures = new Map(); // file → Image (or 'missing')
  }
  text(words, az, el, { size = 3, color = C.ink, weight = 600 } = {}) {
    this.ac.text(String(words), az, el, { size, color, weight, font: FONT });
    return this;
  }
  circle(az, el, size = 3, { color = C.warm, glow = true } = {}) {
    const ac = this.ac, c = ac.ctx, r = (size / 2) * ac.ppd;
    const squeeze = 1 / Math.max(0.2, Math.cos(el * D)); // wider near the top, so it looks round in the dome
    ac.wrapped(az, (x) => {
      c.save();
      c.translate(x, ac.y(el));
      c.scale(squeeze, 1);
      if (glow) {
        const g = c.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.2);
        g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalAlpha = 0.45; c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, r * 2.2, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
      }
      c.fillStyle = color;
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
      c.restore();
    });
    return this;
  }
  box(az, el, width, height, { color = C.warm, fill = 'rgba(20,23,30,0.85)' } = {}) {
    this.ac.rect(az, el, width, height, { fill, stroke: color, lineWidth: 0.25, radius: 0.6 });
    return this;
  }
  picture(file, az, el, width = 20) {
    let img = this.pictures.get(file);
    if (!img) {
      img = new Image();
      this.pictures.set(file, img);
      img.onload = () => this.onPictureLoaded?.();
      img.onerror = () => { this.pictures.set(file, 'missing'); console.warn('picture not found:', file); this.onPictureLoaded?.(); };
      img.src = new URL(file, this.base).href;
    }
    if (img === 'missing') {
      const h = width * 0.6;
      this.box(az, el, width, h, { color: C.red });
      this.text('picture not found:', az, el + 1.5, { size: 1.3, color: C.red });
      this.text(file, az, el - 1.5, { size: 1.3, color: C.ink, weight: 400 });
    } else if (img.complete && img.naturalWidth) {
      this.ac.image(img, az, el, width, width * img.naturalHeight / img.naturalWidth);
    }
    return this;
  }
}

/**
 * simpleSlide({ title, notes, still(draw, dome), moving(draw, t, dome), sound: { file, note, volume, at(t) } })
 *   still   is drawn once (and again when a picture has loaded)
 *   moving  is drawn every frame; t = seconds since the slide started
 *   sound   plays a file from media/ (looping) or, without a file, a soft tone of `note` Hz;
 *           at(t) returns { az, el }: where the sound comes from at time t
 */
export function simpleSlide({ title = 'My slide', act = ACT_SHOW, notes = '', still, moving, sound } = {}) {
  const dome = { sweetSpot: DOME.sweetSpot, screenEdge: rimElevation };
  const params = {};
  if (sound) params.sound = { type: 'toggle', label: 'Sound', value: true };

  return {
    title, act, notes, params,

    video({ comp, AngleCanvas, view, base }) {
      // two layers: one drawn once (sharp), one redrawn every frame (moving things)
      const fixed = new AngleCanvas();
      const live = new AngleCanvas(2048);
      const redrawFixed = () => {
        fixed.clear();
        try { still?.(fixedDraw, dome); } catch (e) { console.error('error in still():', e); }
        fixed.commit();
      };
      const fixedDraw = new Draw(fixed, base, redrawFixed);
      const liveDraw = new Draw(live, base, () => {});
      redrawFixed();
      const mat = comp.material(`${NOISE_GLSL}
        uniform sampler2D uLive;
        vec4 slideColor(vec3 room, vec3 local, vec2 m){
          vec3 c = houseSky(room, 0.8) + stars(room) * 0.3;
          vec4 e = sampleEq(uEq, room);   c = mix(c, e.rgb, e.a);
          vec4 l = sampleEq(uLive, room); c = mix(c, l.rgb, l.a);
          return vec4(c, 1.0);
        }`, { uEq: { value: fixed.texture }, uEqOn: { value: 1 }, uLive: { value: live.texture } });
      return {
        render() {
          if (moving) {
            live.clear();
            try { moving(liveDraw, view.t(), dome); } catch (e) { console.error('error in moving():', e); }
            live.commit();
          }
          return mat;
        },
        dispose() { mat.dispose(); fixed.dispose(); live.dispose(); },
      };
    },

    audio: sound ? ({ group, ctx, view, base }) => {
      const p = group.panner();
      const amp = ctx.createGain(); amp.gain.value = 0;
      amp.connect(p.input);
      const volume = sound.volume ?? 0.3;
      let source = null;
      // a soft tone, used when there is no file (or while it loads, or if it is missing)
      const tone = () => {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = sound.note ?? 220;
        const trem = ctx.createOscillator(); trem.frequency.value = 3;
        const tG = ctx.createGain(); tG.gain.value = 0.3; const body = ctx.createGain(); body.gain.value = 0.7;
        trem.connect(tG).connect(body.gain); o.connect(body).connect(amp);
        o.start(); trem.start();
        return { stop: (t) => { o.stop(t); trem.stop(t); } };
      };
      if (sound.file) {
        fetch(new URL(sound.file, base)).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
          .then((b) => ctx.decodeAudioData(b))
          .then((buf) => {
            const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(amp); s.start();
            source = s;
          })
          .catch(() => { console.warn('sound file not found, playing a tone instead:', sound.file); source = tone(); });
      } else source = tone();
      return {
        update() {
          const t = view.t();
          amp.gain.setTargetAtTime(view.p('sound') ? volume : 0, ctx.currentTime, 0.1);
          const where = sound.at ? sound.at(t) : { az: 0, el: DOME.sweetSpot };
          p.set(where.az, where.el);
        },
        dispose() { source?.stop(ctx.currentTime + 0.5); },
      };
    } : undefined,
  };
}
