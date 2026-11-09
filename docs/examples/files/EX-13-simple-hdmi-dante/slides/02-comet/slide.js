// ═════════════════════════════════════════════════════════════════════════════════════════════
// DEMO SLIDE: SOUND THAT MOVES (5.1)
// A comet circles the room and its sound follows it round the five speakers. The rings on the
// rim light up with each speaker's level: that is the panning, live.
// Copy this one when something should be heard where it is seen.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { ACT_SHOW, C, NOISE_GLSL, SPEAKER_GLSL, speakerUniforms, labelSpeakers, gains51 } from '../_common.js';
import { DOME, dirRoom, localToRoom, azElOf } from '../../lib/dome.js';

// The comet flies in the DOME's own frame: its height is measured from the screen edge, so it
// stays on the screen all the way round (in a tilted dome the edge is low in front, high behind).
const RIM_LOCAL = 90 - Math.min(DOME.opening, DOME.venueFov) / 2;
function toRoom(az, h) { const [raz, rel] = azElOf(localToRoom(dirRoom(az, RIM_LOCAL + h))); return { az: raz, el: rel }; }

// Where is the comet at time `at`? Picture AND sound call this same function, so they agree.
// view.integrate('speed', 1, at) = the speed slider summed over time up to `at` = an angle.
function cometAt(view, at) {
  const az = view.integrate('speed', 1, at);
  const h = view.p('el') + view.p('wobble') * Math.sin(az * Math.PI / 180 * 2);
  return toRoom(az, Math.min(h, 90 - RIM_LOCAL));
}

export default {
  title: 'A comet and 5.1 sound',
  act: ACT_SHOW,
  notes: `<p>The comet circles the room and its sound follows it. Ask people to point at it with their eyes closed.</p>
<ul><li>Raise the <b>height</b> towards the centre of the dome: the sound spreads over all five speakers, because 5.1 has no height channels.</li>
<li>Speed it up: the eye loses the comet behind you, the ear doesn't.</li></ul>`,
  params: {
    speed: { type: 'range', label: 'Speed', min: -180, max: 180, step: 1, value: 36, unit: '°/s' },
    el: { type: 'range', label: 'Height above the screen edge', min: 3, max: 80, step: 1, value: 30, unit: '°' },
    wobble: { type: 'range', label: 'Up–down wobble', min: 0, max: 30, step: 1, value: 6, unit: '°' },
    tail: { type: 'range', label: 'Tail length', min: 5, max: 120, step: 1, value: 45, unit: '°' },
    sound: { type: 'toggle', label: 'Sound', value: true },
    speakers: { type: 'toggle', label: 'Show speakers', value: true },
  },

  video({ THREE, comp, AngleCanvas, view }) {
    const spk = speakerUniforms(THREE);
    const ac = new AngleCanvas(2048);
    labelSpeakers(ac, spk.places); ac.commit();
    const N = 40;                    // the tail is drawn from 40 past positions of the comet
    const mat = comp.material(`${NOISE_GLSL}${SPEAKER_GLSL}
      uniform vec3 uTrail[${N}];     // directions of the comet now (0) and in the past (1..N-1)
      uniform float uShowSpk;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.6) + stars(room) * 0.55;
        float glow = 0.0;
        for (int i = 0; i < ${N}; i++) {                     // a soft blob per tail point, fading out
          float k = float(i) / float(${N});
          float a = angleBetween(room, uTrail[i]);           // degrees between this pixel and the point
          float w = mix(0.9, 3.2, k);
          glow += exp(-a * a / (2.0 * w * w)) * (1.0 - k) * (1.0 - k) * 0.22;
        }
        float a0 = angleBetween(room, uTrail[0]);
        float core = exp(-a0 * a0 / 0.35) + 0.35 * exp(-a0 * a0 / 18.0);
        c += vec3(0.35, 0.75, 1.0) * glow + vec3(1.0, 0.92, 0.8) * core;
        if (uShowSpk > 0.5) {
          c = drawSpeakers(c, room);
          vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        }
        return vec4(c, 1.0);
      }`, { ...spk.uniforms, uEq: { value: ac.texture }, uTrail: { value: Array.from({ length: N }, () => new THREE.Vector3()) }, uShowSpk: { value: 1 } });
    const D = Math.PI / 180;
    return {
      render(t) {
        const u = mat.uniforms;
        const speed = view.p('speed');
        const span = Math.abs(speed) > 1 ? view.p('tail') / Math.abs(speed) : 0.5;   // seconds of history in the tail
        for (let i = 0; i < N; i++) {
          const c = cometAt(view, t - (i / N) * span);
          // azimuth/elevation → a direction vector (x right, y front, z up)
          u.uTrail.value[i].set(Math.cos(c.el * D) * Math.sin(c.az * D), Math.cos(c.el * D) * Math.cos(c.az * D), Math.sin(c.el * D));
        }
        const now = cometAt(view, t);
        // gains51(az, el) = how loud each of the 6 channels is for a sound at that direction:
        // the same law the sound page uses, so the rings show what you hear
        spk.setFromGains(u, view.p('sound') ? gains51(now.az, now.el) : new Float32Array(6));
        u.uShowSpk.value = view.p('speakers') ? 1 : 0;
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },

  // The sound: filtered noise ("whoosh") plus two soft tones, through ONE 5.1 panner that is
  // moved to the comet's direction 30 times a second.
  audio({ group, ctx, view }) {
    const p = group.panner();
    const amp = ctx.createGain(); amp.gain.value = 0;
    const n = group.noise();                               // a ready-made white-noise source
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2;
    const nG = ctx.createGain(); nG.gain.value = 0.9;
    n.connect(bp).connect(nG).connect(amp);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 330;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 495.7;
    const oG = ctx.createGain(); oG.gain.value = 0.18;
    o.connect(oG); o2.connect(oG); oG.connect(amp);
    amp.connect(p.input);
    n.start(); o.start(); o2.start();
    return {
      update(t) {
        const c = cometAt(view, t);
        amp.gain.setTargetAtTime(view.p('sound') ? 0.5 : 0, ctx.currentTime, 0.1);
        // p.set(azimuth, elevation, spread 0..1, smoothing seconds)
        p.set(c.az, c.el, 0, 0.02);
        const sp = Math.min(1, Math.abs(view.p('speed')) / 180);   // faster = brighter
        bp.frequency.setTargetAtTime(900 + 2600 * sp, ctx.currentTime, 0.1);
        o.frequency.setTargetAtTime(300 + 120 * sp, ctx.currentTime, 0.1);
      },
      dispose() { const s = ctx.currentTime + 0.5; n.stop(s); o.stop(s); o2.stop(s); },
    };
  },
};
