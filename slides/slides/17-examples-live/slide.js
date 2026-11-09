import { ACT3, C } from '../_common.js';

// The example pages run in a hidden iframe; their canvas is the dome master.
const PAGES = {
  pulse: { src: '/outputs/06-examples/EX-03-webgl-glsl/pulse.html', label: 'EX-03 · Pulse · WebGL / GLSL, one HTML file, mic-reactive · Track B' },
  chorus: { src: '/outputs/06-examples/EX-04-p5js/chorus.html', label: 'EX-04 · Chorus · p5.js, the gentlest start · Track A or B' },
};

export default {
  title: 'Our examples: live (Track B)',
  act: ACT3,
  notes: `<p>The two browser examples, <b>running live</b> in the dome right now. They are ordinary web pages; these slides just show their canvas.</p>
<ul><li><b>Pulse</b>: a single GLSL fragment shader. Every pixel asks "what is my azimuth and elevation?" and colours itself.</li>
<li><b>Chorus</b>: p5.js. Arcs drawn by angle with a small helper that turns (azimuth, elevation) into a point on the fisheye.</li></ul>
<p>Open either file on your laptop during the week: no install, works offline.</p>`,
  params: {
    page: { type: 'select', label: 'Example', options: [{ value: 'pulse', label: 'EX-03 Pulse' }, { value: 'chorus', label: 'EX-04 Chorus' }], value: 'pulse' },
    label: { type: 'toggle', label: 'Caption', value: true },
  },
  video({ THREE, comp, AngleCanvas, view, frames }) {
    const ac = new AngleCanvas(2048);
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:1024px;opacity:0.001;pointer-events:none;z-index:-1;overflow:hidden';
    document.body.append(holder);
    let iframe = null, canvasTex = null, cur = null, srcCanvas = null;
    const empty = new THREE.DataTexture(new Uint8Array(4), 1, 1); empty.needsUpdate = true;
    const load = (k) => {
      cur = k; srcCanvas = null;
      holder.replaceChildren();
      iframe = document.createElement('iframe');
      iframe.style.cssText = 'width:1024px;height:1024px;border:0';
      iframe.src = PAGES[k].src;
      iframe.onload = () => {
        const d = iframe.contentDocument;
        const st = d.createElement('style');
        st.textContent = '#ui,#toggle,#help,header,aside,.ui{display:none!important} body{margin:0!important}';
        d.head.append(st);
        const find = () => { srcCanvas = d.querySelector('canvas'); if (!srcCanvas) setTimeout(find, 100); else { canvasTex?.dispose(); canvasTex = new THREE.CanvasTexture(srcCanvas); canvasTex.minFilter = THREE.LinearFilter; canvasTex.generateMipmaps = false; mat.uniforms.uSrc.value = canvasTex; } };
        find();
      };
      holder.append(iframe);
      ac.clear().text(PAGES[k].label, 0, 6, { size: 1.3, color: C.mute, weight: 550 }).commit();
    };
    const mat = comp.material(`
      uniform sampler2D uSrc; uniform float uLabel;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = texture(uSrc, m * 0.5 + 0.5).rgb;
        vec4 e = sampleEq(uEq, room);
        return vec4(mix(c, e.rgb, e.a * uLabel), 1.0);
      }`, { uSrc: { value: empty }, uEq: { value: ac.texture }, uLabel: { value: 1 } });
    return {
      render() {
        if (view.p('page') !== cur) load(view.p('page'));
        if (canvasTex) canvasTex.needsUpdate = true;
        mat.uniforms.uLabel.value = view.p('label') ? 1 : 0;
        return mat;
      },
      dispose() { holder.remove(); canvasTex?.dispose(); empty.dispose(); mat.dispose(); ac.dispose(); },
    };
  },
};
