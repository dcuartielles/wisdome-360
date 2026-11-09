// First slide when the server starts: Paul Bourke's fulldome test pattern, shown as it is,
// as the whole dome master. The PNG lives next to this file (2048.png) with LICENSE.txt.
// Licence: free to use and distribute UNMODIFIED, with the licence statement. So the picture
// itself is never changed here: no rotation, no remapping. Our guides can be laid over it
// (presenter toggle) to compare our mapping with the venue's, but that is an overlay on screen.
import { C } from '../_common.js';
import { DOME } from '../../lib/dome.js';

export default {
  title: 'Test pattern (Paul Bourke)',
  act: 'Before we start',
  get notes() {
    return `<p>The slide the server opens on. <b>Paul Bourke's fulldome test pattern</b>, untouched, as the whole dome master: the same file the Wisdome technicians use.</p>
<ul><li><b>Mapping</b>: the venue spreads this circle over its ${DOME.venueFov}° screen. The rim of the picture should sit exactly on the rim of the screen; the rings should be round and evenly spaced.</li>
<li><b>Front</b>: the bottom of the file should be the front of the room.</li>
<li><b>Resolution</b>: text characters are 12 px wide; read a "0", "3" or "8" near the rim. In the top-right and bottom-left quadrants, the finest rings and line pairs should not melt into grey. This is the 2048 pattern: OBS sends a 2048² canvas.</li>
<li><b>Colour</b>: white grid lines show chromatic errors near the rim; colour swatches at 50% and 100% saturation, grey swatches at 25/50/75/100%; star-like points 1–4 px wide.</li>
<li><b>Our guides over it</b> (toggle): our rings, the rim at ${DOME.opening}, the venue scale (pink, 0 at the rim, 90 at the centre) and the sweet spot, drawn on top. If our mapping and the venue's agree, our pink rings land on the pattern's rings.</li></ul>
<p class="hint">Fulldome test pattern by Paul Bourke. The images may be freely used under the condition it is not modified in any way. The image may be freely distributed as long as this license statement is included. paulbourke.net/dome/testpattern</p>`;
  },
  params: {
    guides: { type: 'toggle', label: 'Our guides on top (rings, rim, venue scale, sweet spot)', value: false, hint: 'Overlay only: the pattern itself is not changed' },
  },
  video({ THREE, comp, AngleCanvas, view, base }) {
    const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blank.needsUpdate = true;
    const tex = { 2048: null, 4096: null };
    const missing = new AngleCanvas(2048);
    let failed = {};
    const load = (r) => {
      if (tex[r] || failed[r]) return;
      tex[r] = 'loading';
      new THREE.TextureLoader().load(`${base}${r}.png`, (t) => {
        t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 1;
        tex[r] = t;
      }, undefined, () => {
        tex[r] = null; failed[r] = true;
        missing.clear().text('Test pattern not found', 0, 30, { size: 2.4, weight: 750, color: C.red })
          .text(`put Paul Bourke's ${r}.png in live/slides/00-test-pattern/`, 0, 26, { size: 1.3, weight: 500, color: C.ink })
          .text('paulbourke.net/dome/testpattern', 0, 23.5, { size: 1.1, weight: 500, color: C.mute }).commit();
      });
    };
    const mat = comp.material(`
      uniform sampler2D uImg; uniform float uHas;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        if (uHas > 0.5) return vec4(texture(uImg, m * 0.5 + 0.5).rgb, 1.0);   // the file as it is: master pixel = pattern pixel
        vec3 c = vec3(0.02);
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { uImg: { value: blank }, uHas: { value: 0 }, uEq: { value: missing.texture } });
    const inst = {
      guides: {},
      render() {
        const r = '2048';
        load(r);
        const t = tex[r];
        const ok = t && t !== 'loading';
        mat.uniforms.uImg.value = ok ? t : blank;
        mat.uniforms.uHas.value = ok ? 1 : 0;
        const g = view.p('guides') ? 1 : 0;
        inst.guides = { rings: g, rim: g, sweet: g, venue: g };
        return mat;
      },
      dispose() { mat.dispose(); missing.dispose(); for (const t of Object.values(tex)) if (t && t.dispose) t.dispose(); blank.dispose(); },
    };
    return inst;
  },
};
