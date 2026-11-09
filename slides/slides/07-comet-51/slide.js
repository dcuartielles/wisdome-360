import { ACT1, C, NOISE_GLSL, SPEAKER_GLSL, speakerUniforms, labelSpeakers, gains51 } from '../_common.js';
import { DOME, dirRoom, localToRoom, azElOf } from '../../lib/dome.js';

// The comet flies in the DOME's frame: 'el' is its height above the screen edge, so it stays on the
// screen all the way round (the dome is tilted: the edge is 16° below eye level in front, 36° above behind).
const RIM_LOCAL = 90 - Math.min(DOME.opening, DOME.venueFov) / 2;
function toRoom(az, h) { const [raz, rel] = azElOf(localToRoom(dirRoom(az, RIM_LOCAL + h))); return { az: raz, el: rel }; }

function cometAt(view, at) {
  const az = view.integrate('speed', 1, at);
  const h = view.p('el') + view.p('wobble') * Math.sin(view.integrate('speed', 1, at) * Math.PI / 180 * 2);
  return toRoom(az, Math.min(h, 90 - RIM_LOCAL));
}

export default {
  title: 'A comet and 5.1 sound',
  act: ACT1,
  notes: `<p>The comet circles the room and its sound follows it around the five speakers. The rings on the rim light up with each speaker's level. That's the panning, live.</p>
<ul><li>The comet flies at a <b>height above the screen edge</b>, so it never drops under the rim behind you (the dome is tilted: in front it passes about 14° up, behind about 66°).</li>
<li>Raise the <b>height</b> towards the centre of the dome: the sound spreads over all five speakers, because 5.1 has no height channels. Overhead is "everywhere".</li>
<li>Speed it up: the eye loses the comet behind you, but the ear doesn't.</li>
<li>Ask: where is it right now? Point! Then compare the pointing with the picture.</li></ul>
<p>Sound only moves as far as the speakers allow. In 5.1 the front is detailed (L C R), the back is two speakers (Ls Rs).</p>`,
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
    const N = 40;
    const mat = comp.material(`${NOISE_GLSL}${SPEAKER_GLSL}
      uniform vec3 uTrail[${N}];
      uniform float uShowSpk;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.6) + stars(room) * 0.55;
        float glow = 0.0, core = 0.0;
        for (int i = 0; i < ${N}; i++) {
          float k = float(i) / float(${N});
          float a = angleBetween(room, uTrail[i]);
          float w = mix(0.9, 3.2, k);
          glow += exp(-a * a / (2.0 * w * w)) * (1.0 - k) * (1.0 - k) * 0.22;
        }
        float a0 = angleBetween(room, uTrail[0]);
        core = exp(-a0 * a0 / 0.35) + 0.35 * exp(-a0 * a0 / 18.0);
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
        const tailDeg = view.p('tail');
        const span = Math.abs(speed) > 1 ? tailDeg / Math.abs(speed) : 0.5; // seconds of history in the tail
        for (let i = 0; i < N; i++) {
          const c = cometAt(view, t - (i / N) * span);
          u.uTrail.value[i].set(Math.cos(c.el * D) * Math.sin(c.az * D), Math.cos(c.el * D) * Math.cos(c.az * D), Math.sin(c.el * D));
        }
        const now = cometAt(view, t);
        spk.setFromGains(u, view.p('sound') ? gains51(now.az, now.el) : new Float32Array(6));
        u.uShowSpk.value = view.p('speakers') ? 1 : 0;
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },

  audio({ group, ctx, view }) {
    const p = group.panner();
    const amp = ctx.createGain(); amp.gain.value = 0;
    // body: filtered noise "whoosh" + a soft sine with a little shimmer
    const n = group.noise();
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
        const on = view.p('sound');
        amp.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.1);
        p.set(c.az, c.el, 0, 0.02);
        const sp = Math.min(1, Math.abs(view.p('speed')) / 180);
        bp.frequency.setTargetAtTime(900 + 2600 * sp, ctx.currentTime, 0.1);
        o.frequency.setTargetAtTime(300 + 120 * sp, ctx.currentTime, 0.1);
      },
      dispose() { const s = ctx.currentTime + 0.5; n.stop(s); o.stop(s); o2.stop(s); },
    };
  },
};
