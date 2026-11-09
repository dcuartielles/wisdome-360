import { ACTX, C } from '../_common.js';
import { DOME } from '../../lib/dome.js';

export default {
  title: 'AV sync: flash + click',
  act: ACTX,
  notes: `<p>A white flash and a click, once a second, both scheduled for the same server time.</p>
<p>Film the dome with a phone (slow motion if you have it). Count the frames between the flash and the click in the recording, then set <b>Audio delay</b> on the left so they land together. If the picture (HDMI, through the venue's processing) arrives later than the Dante sound, delay the audio; if the sound is later (the bridge adds about 110 ms), leave it at 0.</p>
<p>The value is stored per machine (laptop and Mac mini will differ).</p>`,
  params: { rate: { type: 'select', label: 'Flashes', options: [{ value: '1', label: '1 per second' }, { value: '2', label: '2 per second' }], value: '1' } },
  video({ comp, AngleCanvas, view }) {
    const ac = new AngleCanvas(2048);
    const F = DOME.sweetSpot + 2;   // the flash (14° radius) just above the sweet spot, the title over it, the hint under it
    ac.text('AV sync', 0, F + 19.5, { size: 2.4, weight: 750, color: C.ink })
      .text('the flash and the click should land together: adjust "Audio delay" on the presenter', 0, F - 18, { size: 1.2, color: C.mute, weight: 500 }).commit();
    const mat = comp.material(`
      uniform float uFlash, uHand;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = vec3(0.0);
        float a = angleBetween(room, dirRoom(0.0, ${F.toFixed(2)}));
        c = mix(c, vec3(1.0), (1.0 - smoothstep(13.5, 14.0, a)) * uFlash);
        c = mix(c, vec3(0.6), aaLine(a - 14.5, 0.25));
        // a sweeping hand: one turn per second, 12 ticks
        vec2 uv = cardUV(room, dirRoom(0.0, ${F.toFixed(2)}), 34.0, 1.0, 0.0);
        if (uv.x >= 0.0) {
          vec2 p = uv * 2.0 - 1.0;
          float ang = atan(p.x, p.y) / (2.0 * PI); ang = fract(ang + 1.0);
          float d = fract(ang - uHand + 1.0);
          c += vec3(1.0, 0.71, 0.28) * step(length(p), 0.8) * step(0.25, length(p)) * smoothstep(0.985, 1.0, 1.0 - d) * 0.9;
          float tick = step(0.86, length(p)) * step(length(p), 0.94) * (1.0 - smoothstep(0.004, 0.008, abs(fract(ang * 12.0 + 0.5) - 0.5) / 12.0));
          c = max(c, vec3(tick));
        }
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uFlash: { value: 0 }, uHand: { value: 0 } });
    return {
      render(t) {
        const r = Number(view.p('rate'));
        const ph = (t * r) % 1;
        mat.uniforms.uFlash.value = ph < 0.067 * r ? 1 : 0;   // ~2 frames at 30 fps
        mat.uniforms.uHand.value = t % 1;
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },
  audio({ group, ctx, view, ctxTime }) {
    const out = group.channel(2); // centre
    const outL = group.channel(0), outR = group.channel(1);
    let next = 0;
    return {
      update(t) {
        const r = Number(view.p('rate'));
        if (next < t) next = Math.ceil(t * r) / r;
        while (next < t + 0.3) {
          const when = ctxTime(next);
          if (when > ctx.currentTime) {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.frequency.value = 1000; g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.6, when + 0.001); g.gain.setValueAtTime(0.6, when + 0.02); g.gain.linearRampToValueAtTime(0, when + 0.025);
            o.connect(g); g.connect(out); g.connect(outL); g.connect(outR);
            o.start(when); o.stop(when + 0.03);
          }
          next += 1 / r;
        }
      },
    };
  },
};
