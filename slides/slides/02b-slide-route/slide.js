import { ACT1, C, NOISE_GLSL } from '../_common.js';
import { domeArtCanvas } from '../_domeart.js';
import { drawSlideFrame, screenPlace, W, H } from '../_slideframe.js';

const AUTO = 5;    // seconds before the circle moves by itself
const MOVE = 2.6;  // seconds the move takes
const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

export default {
  title: 'Presenting with 16:9 slides',
  act: ACT1,
  steps: 1,        // the first Next moves the circle, the second goes to the next slide
  autoStep: AUTO,  // only counts when 'Move by itself' is switched on
  notes: `<p>The simplest way onto the dome: an ordinary <b>16:9 slide, 3840 × 2160</b> (2160 px high), the venue's own slideshow route.</p>
<p>When you press <b>Next</b> (or the button), the circle moves to the middle and grows to the full height. That middle circle, 2160 × 2160, <b>is the dome</b>: the venue puts the centre of your slide on the dome, the sides are lost, and only about the inner 160° of the circle is projected (red ring).</p>
<ul><li>So: make your slide 2160 px high, keep everything that matters <b>inside the middle circle</b>, bottom of the circle = front.</li>
<li>Next slide: what the dome actually shows.</li></ul>`,
  params: {
    step: { type: 'button', label: 'Move the circle to the centre', hint: 'or press Next' },
    auto: { type: 'toggle', label: `Move by itself after ${AUTO} s`, value: false },
  },
  video({ THREE, comp, view }) {
    const art = domeArtCanvas(1024);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 8;
    let lastP = -1;
    const scr = screenPlace();
    const mat = comp.material(`${NOISE_GLSL}
      uniform sampler2D uImg;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.5) + stars(room) * 0.2;
        vec2 uv = cardUV(room, dirRoom(0.0, ${scr.el.toFixed(2)}), ${scr.w.toFixed(1)}, ${(W / H).toFixed(4)}, 0.0);
        if (uv.x >= 0.0) c = texture(uImg, uv).rgb;
        return vec4(c, 1.0);
      }`, { uImg: { value: tex } });
    return {
      render(t) {
        const start0 = view.now() - view.t();
        let go = view.lastPress('step');                 // -Infinity until Next / the button is pressed
        if (!isFinite(go)) go = view.p('auto') ? start0 + AUTO : Infinity; // no press yet: wait
        else if (view.p('auto')) go = Math.min(go, start0 + AUTO);
        const p = ease((t - go) / MOVE);
        if (Math.abs(p - lastP) > 1e-4) { lastP = p; drawSlideFrame(g, art, p); tex.needsUpdate = true; }
        return mat;
      },
      dispose() { mat.dispose(); tex.dispose(); },
    };
  },
};
