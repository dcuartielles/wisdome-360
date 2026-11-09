import { ACT1, C, NOISE_GLSL } from '../_common.js';
import { DOME } from '../../lib/dome.js';

// edit the words here
const TITLE = 'Composing for the dome';
const SUB = '360° projection with open tools';
const LINE = 'Wisdome Malmö  ·  Malmö University  ·  EDT / TEI';

export default {
  title: 'Composing for the dome',
  act: ACT1,
  get notes() { return `<p>Lights down before this slide. Let the stars settle for a few seconds.</p>
<p>Point out: the title sits <b>straight ahead</b>, in front of everyone, on the venue's sweet spot (their 40°, about ${Math.round(DOME.sweetSpot)}° up: compare with the guides, G). Everything this week is about placing things by <b>angle</b>, not by pixel.</p>
<p>Optional: switch on the ambience and let it circle once, so they hear the room before you explain it.</p>`; },
  params: {
    drift: { type: 'range', label: 'Sky drift', min: -3, max: 3, step: 0.1, value: 0.6, unit: '°/s' },
    ambience: { type: 'toggle', label: 'Ambience (circling drone)', value: false },
  },

  video({ comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    const S = DOME.sweetSpot;  // the block centred on the sweet spot
    ac.text(TITLE, 0, S + 5.5, { size: 4.2, weight: 700, color: C.ink })
      .text(SUB, 0, S - 1, { size: 2.2, weight: 400, color: C.warm })
      .text(LINE, 0, S - 6, { size: 1.4, weight: 500, color: C.mute, letter: 0.15 })
      .commit();
    const mat = comp.material(`${NOISE_GLSL}
      uniform float uSpin;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        float a = uSpin * DEG;
        vec3 d = vec3(room.x * cos(a) - room.y * sin(a), room.x * sin(a) + room.y * cos(a), room.z);
        vec3 c = houseSky(room, 1.0) + stars(d) * smoothstep(-5.0, 15.0, elOf(room));
        vec4 e = sampleEq(uEq, room);
        return vec4(mix(c, e.rgb, e.a), 1.0);
      }`, { uEq: { value: ac.texture }, uEqOn: { value: 1 }, uSpin: { value: 0 } });
    return {
      render(t) { mat.uniforms.uSpin.value = view.integrate('drift'); return mat; },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },

  audio({ group, ctx, view }) {
    // a soft drone: two detuned saws through a slow filter, circling the room once a minute
    const p = group.panner();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 2;
    const amp = ctx.createGain(); amp.gain.value = 0;
    const oscs = [55, 55.4, 82.5].map((f) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); return o; });
    lp.connect(amp).connect(p.input);
    p.lfe(0.3);
    return {
      update(t) {
        const on = view.p('ambience');
        amp.gain.setTargetAtTime(on ? 0.12 : 0, ctx.currentTime, 0.6);
        const ts = view.t();
        lp.frequency.setTargetAtTime(350 + 250 * Math.sin(ts * 0.21), ctx.currentTime, 0.2);
        p.set((ts * 6) % 360, 20);
      },
      dispose() { oscs.forEach((o) => o.stop(ctx.currentTime + 0.5)); },
    };
  },
};
