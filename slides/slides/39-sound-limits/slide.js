import { C, NOISE_GLSL, SPEAKER_GLSL, speakerUniforms, labelSpeakers, gains51 } from '../_common.js';
import { ACT5, header } from '../_lab.js';

export default {
  title: 'Sound has no height',
  act: ACT5,
  notes: `<p>The picture covers a hemisphere; the 5.1 sound is a ring of five speakers at ear level plus a subwoofer. Three limits you can hear:</p>
<ul><li><b>No height.</b> Ping the sound and raise <b>Elevation</b>: the picture goes up, the sound does not — it spreads over all five speakers and becomes "everywhere". Overhead events need to be sold by the picture, or by sound that <i>implies</i> height (a rising pitch, a fall).</li>
<li><b>The back is thin.</b> Sweep <b>Azimuth</b> round: the front has three speakers (L C R), the back has two, far apart. Sounds behind the audience are vague.</li>
<li><b>Your seat decides.</b> Switch to <b>Precedence</b>: the same click from L and R. At 0 ms people in the middle hear it in the centre; people on the sides hear it from their side. Add a few milliseconds of delay to R: everyone hears L — the first sound wins (the precedence effect). A 5 m walk across the room is ~15 ms of sound travel.</li></ul>
<p>The rings above the rim show each speaker's level, live.</p>`,
  params: {
    mode: { type: 'select', label: 'Demo', options: [{ value: 'move', label: 'Move a sound' }, { value: 'prec', label: 'Precedence (L vs R)' }], value: 'move' },
    az: { type: 'range', label: 'Azimuth', min: -180, max: 180, step: 1, value: 0, unit: '°' },
    el: { type: 'range', label: 'Elevation', min: 0, max: 90, step: 1, value: 20, unit: '°' },
    delay: { type: 'range', label: 'Delay R after L', min: -30, max: 30, step: 0.5, value: 0, unit: 'ms' },
    loop: { type: 'toggle', label: 'Repeat every second', value: true },
    ping: { type: 'button', label: 'Ping' },
  },
  video({ THREE, comp, AngleCanvas, view }) {
    const spk = speakerUniforms(THREE);
    const ac = new AngleCanvas();
    header(ac, 'Sound has no height', '5 speakers at ear level: the picture can go up, the sound cannot', 'try: ping, then raise the elevation — then sweep round to the back');
    labelSpeakers(ac, spk.places);
    ac.commit();
    const D = Math.PI / 180;
    const mat = comp.material(`${NOISE_GLSL}${SPEAKER_GLSL}
      uniform vec3 uSrc; uniform float uPulse, uMode;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.6) + stars(room) * 0.3;
        if (uMode < 0.5) {
          float a = angleBetween(room, uSrc);
          c += vec3(0.4, 0.8, 1.0) * (exp(-a * a / 3.0) + 0.6 * exp(-pow(a - uPulse * 25.0, 2.0) / 6.0) * (1.0 - uPulse));
          c = mix(c, vec3(0.6, 0.9, 1.0), aaLine(a - 3.0, 0.3));
        }
        c = drawSpeakers(c, room);
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { ...spk.uniforms, uEq: { value: ac.texture }, uSrc: { value: new THREE.Vector3() }, uPulse: { value: 1 }, uMode: { value: 0 } });
    return {
      render(t) {
        const u = mat.uniforms, az = view.p('az'), el = view.p('el');
        u.uSrc.value.set(Math.cos(el * D) * Math.sin(az * D), Math.cos(el * D) * Math.cos(az * D), Math.sin(el * D));
        const ph = view.p('loop') ? (view.t() % 1) : Math.min(1, t - view.lastPress('ping'));
        u.uPulse.value = Math.min(1, ph / 0.6);
        const prec = view.p('mode') === 'prec';
        u.uMode.value = prec ? 1 : 0;
        const lvl = Math.max(0, 1 - ph * 3);
        let g;
        if (prec) { g = new Float32Array(6); const d = view.p('delay'); g[0] = d >= 0 ? lvl : lvl * 0.7; g[1] = d <= 0 ? lvl : lvl * 0.7; }
        else g = gains51(az, el).map((v) => v * lvl);
        spk.setFromGains(u, g);
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },
  audio({ group, ctx, view, ctxTime }) {
    const p = group.panner();
    const l = group.channel(0), r = group.channel(1);
    const bus = ctx.createGain(); bus.gain.value = 0.8; bus.connect(p.input);
    function ping(when, dest) {
      const o = ctx.createOscillator(), e = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(1320, when); o.frequency.exponentialRampToValueAtTime(880, when + 0.25);
      e.gain.setValueAtTime(0, when); e.gain.linearRampToValueAtTime(0.5, when + 0.003); e.gain.exponentialRampToValueAtTime(0.001, when + 0.35);
      o.connect(e).connect(dest); o.start(when); o.stop(when + 0.4);
      const n = group.noise(), ne = ctx.createGain(), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
      ne.gain.setValueAtTime(0, when); ne.gain.linearRampToValueAtTime(0.35, when + 0.001); ne.gain.exponentialRampToValueAtTime(0.001, when + 0.03);
      n.connect(hp).connect(ne).connect(dest); n.start(when, Math.random()); n.stop(when + 0.05);
    }
    const done = new Set();
    let next = null;
    return {
      update(t) {
        p.set(view.p('az'), view.p('el'), 0, 0.02);
        const fire = (at) => {
          const when = ctxTime(at);
          if (when < ctx.currentTime) return;
          if (view.p('mode') === 'prec') {
            const d = view.p('delay') / 1000;
            ping(when + Math.max(0, -d), l); ping(when + Math.max(0, d), r);
          } else ping(when, bus);
        };
        for (const at of view.presses('ping')) if (!done.has(at)) { done.add(at); fire(at); }
        if (view.p('loop')) {
          const start = t - view.t();                     // slide start, server time
          const k = Math.ceil(view.t());
          if (next === null || next < start + k) next = start + k;
          while (next < t + 0.2) { fire(next); next += 1; }
        } else next = null;
      },
    };
  },
};
