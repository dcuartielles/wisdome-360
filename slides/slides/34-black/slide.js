import { ACT5, header } from '../_lab.js';

export default {
  title: 'Black isn’t black',
  act: ACT5,
  notes: `<p>Five projectors each send some light even when told to show black. Where two of them overlap (the <b>blend zones</b>) both blacks add up: on a dark picture you see lighter bands — the real seams of the system. Content usually hides them; this slide shows them.</p>
<ul><li><b>Black</b>: the whole dome at 0. Turn off the room lights and ask people to find the bands.</li>
<li><b>Level</b>: raise to 1–3%. At some level the bands vanish into the picture: that is the darkest grey you can really use.</li>
<li><b>Fine grid</b>: one-pixel white lines everywhere. Where a line crosses a blend zone and the projectors are a fraction of a pixel out of register, it goes soft or doubles.</li>
<li><b>Steps</b>: 0 · 1 · 2 · 3 · 5 · 8 · 12% bands. How many can people tell apart?</li></ul>
<p><b>Simulate blends</b> is for rehearsing on the laptop only: it fakes brighter overlap bands at guessed positions. Turn it off in the dome — the dome shows the real ones.</p>
<p>Lesson: dark pieces are beautiful in a dome, but "black" has a floor. Design for it, and ask the technician where the blends are.</p>`,
  params: {
    pattern: { type: 'select', label: 'Pattern', options: [{ value: '0', label: 'Flat field' }, { value: '1', label: 'Fine grid' }, { value: '2', label: 'Steps' }], value: '0' },
    level: { type: 'range', label: 'Level', min: 0, max: 0.12, step: 0.002, value: 0, unit: '' },
    text: { type: 'toggle', label: 'Show the title', value: true },
    sim: { type: 'toggle', label: 'Simulate blends (laptop only)', value: false },
  },
  video({ comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'Black isn’t black', 'switch the lights off: the lighter bands are where projectors overlap', 'try: flat field at 0, then raise the level until the bands disappear');
    ac.commit();
    const mat = comp.material(`
      uniform float uPat, uLvl, uText, uSim;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        float el = elOf(room), az = azOf(room);
        vec3 c = vec3(uLvl);
        if (uPat > 0.5 && uPat < 1.5) {
          // one-pixel lines every 10 degrees, measured in master pixels so they stay 1 px wide
          vec2 g = abs(fract(vec2(az, el) / 10.0 + 0.5) - 0.5) * 10.0;
          vec2 w = fwidth(vec2(az, el));
          w.x = min(w.x, 5.0);                                   // the az seam at the back
          float l = max(step(g.x, w.x * 0.6) * step(el, 84.0), step(g.y, w.y * 0.6));
          c = mix(c, vec3(1.0), l);
        } else if (uPat > 1.5) {
          float steps[7] = float[7](0.0, 0.01, 0.02, 0.03, 0.05, 0.08, 0.12);
          int i = int(clamp(floor((el + 20.0) / 14.0), 0.0, 6.0));
          c = vec3(steps[i]);
        }
        if (uSim > 0.5) {
          // guessed overlaps: four side projectors + one top, blends 8° wide
          float side = 0.0;
          for (int k = 0; k < 4; k++) { float a0 = -135.0 + 90.0 * float(k); side = max(side, 1.0 - smoothstep(0.0, 4.0, abs(mod(az - a0 + 180.0, 360.0) - 180.0))); }
          float top = 1.0 - smoothstep(0.0, 4.0, abs(degrees(acos(clamp(local.z, -1.0, 1.0))) - 34.0));
          c += vec3(0.022, 0.024, 0.03) * max(side * step(el, 70.0), top);
        }
        if (uText > 0.5) { vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a * 0.85); }
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uPat: { value: 0 }, uLvl: { value: 0 }, uText: { value: 1 }, uSim: { value: 0 } });
    return {
      render() {
        const u = mat.uniforms;
        u.uPat.value = Number(view.p('pattern')); u.uLvl.value = view.p('level');
        u.uText.value = view.p('text') ? 1 : 0; u.uSim.value = view.p('sim') ? 1 : 0;
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },
};
