import { NOISE_GLSL, C } from '../_common.js';
import { ACT5, header, labEls } from '../_lab.js';

export default {
  title: 'Vection: the room moves',
  act: ACT5,
  notes: `<p>When most of what you see turns, the brain decides <b>you</b> are turning. That is <b>vection</b>. In a dome it is strong: people lean, grip the armrests, and a few feel sick.</p>
<ul><li>Start slow (<b>Yaw</b>, 3–5°/s). Ask people to close their eyes for a second and open them: the turning is felt in the body.</li>
<li><b>Pitch</b> tips the room forward. <b>Roll</b> rotates it round the front: the strongest and least pleasant. Keep it short and warn people first.</li>
<li>Turn on <b>Stable frame</b>: a fixed window frame in front. Vection drops — the eye has something that does not move. Cockpits, railings and horizons work the same way.</li>
<li>Sound adds to it: the rumble pans with the turn.</li></ul>
<p>Lesson: vection is the dome's most physical effect. Use it on purpose, briefly, and never roll by accident. Reading: Keshavarz et al. (2015).</p>`,
  params: {
    axis: { type: 'select', label: 'Axis', options: [{ value: 'yaw', label: 'Yaw (turn)' }, { value: 'pitch', label: 'Pitch (tip)' }, { value: 'roll', label: 'Roll ⚠' }], value: 'yaw' },
    speed: { type: 'range', label: 'Speed', min: -30, max: 30, step: 0.5, value: 4, unit: '°/s' },
    frame: { type: 'toggle', label: 'Stable frame', value: false },
    sound: { type: 'toggle', label: 'Rumble', value: true },
  },
  video({ THREE, comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'Vection: the room moves', 'when everything you see turns, your body decides it is turning', 'try: slow yaw, then roll — then add the stable frame');
    ac.commit();
    const FR = labEls().centre - 2;   // the stable frame: 60° wide, about 40° tall, under the title, just above the "try" line
    const mat = comp.material(`${NOISE_GLSL}
      uniform mat3 uRot;
      uniform float uFrame;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 d = uRot * room;                               // the world, turned
        float el = elOf(d);
        // a world with strong cues: stars, a horizon glow, and a ring of tall landmarks
        vec3 c = stars(d) * 1.1 + vec3(0.10, 0.05, 0.02) * exp(-abs(el) / 6.0);
        float az = azOf(d);
        float s = abs(fract(az / 30.0) - 0.5) * 30.0;
        c += vec3(0.25, 0.35, 0.55) * (1.0 - smoothstep(1.2, 1.6, s * cos(el * DEG))) * step(-10.0, el) * step(el, 22.0 + 10.0 * sin(floor(az / 30.0) * 2.7));
        c += vec3(0.12, 0.08, 0.05) * step(el, 0.0) * (0.5 + 0.5 * step(0.5, fract(az / 10.0)));
        if (uFrame > 0.5) {
          vec2 uv = cardUV(room, dirRoom(0.0, ${FR.toFixed(2)}), 60.0, 1.6, 0.0);
          float inside = uv.x >= 0.0 ? 1.0 : 0.0;
          vec2 b = abs(uv - 0.5);
          float border = inside * (step(0.47, b.x) + step(0.45, b.y) + step(abs(uv.x - 0.5), 0.006) + step(abs(uv.y - 0.5), 0.01));
          c = mix(c * (inside > 0.5 ? 1.0 : 0.25), vec3(0.22, 0.2, 0.18), clamp(border, 0.0, 1.0));
          if (inside < 0.5) c += vec3(0.04, 0.035, 0.03);
        }
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uRot: { value: new THREE.Matrix3() }, uFrame: { value: 0 } });
    return {
      render() {
        const a = view.integrate('speed') * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
        const axis = view.p('axis');
        // rows of a rotation in room coords (x right, y front, z up)
        const M = axis === 'yaw' ? [c, -s, 0, s, c, 0, 0, 0, 1] : axis === 'pitch' ? [1, 0, 0, 0, c, -s, 0, s, c] : [c, 0, s, 0, 1, 0, -s, 0, c];
        mat.uniforms.uRot.value.set(...M);
        mat.uniforms.uFrame.value = view.p('frame') ? 1 : 0;
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },
  audio({ group, ctx, view }) {
    const p = group.panner();
    const n = group.noise();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    const g = ctx.createGain(); g.gain.value = 0;
    n.connect(lp).connect(g).connect(p.input); n.start();
    p.lfe(0.6);
    return {
      update() {
        const sp = Math.abs(view.p('speed'));
        g.gain.setTargetAtTime(view.p('sound') ? Math.min(0.9, sp / 20) : 0, ctx.currentTime, 0.2);
        lp.frequency.setTargetAtTime(120 + sp * 12, ctx.currentTime, 0.2);
        const az = view.p('axis') === 'yaw' ? -view.integrate('speed') : 0;
        p.set(az, 15, view.p('axis') === 'yaw' ? 0.15 : 0.7, 0.1);
      },
      dispose() { n.stop(ctx.currentTime + 0.5); },
    };
  },
};
