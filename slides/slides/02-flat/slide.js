import { ACT1, C, NOISE_GLSL } from '../_common.js';
import { DOME } from '../../lib/dome.js';
import { FONT } from '../../lib/anglecanvas.js';

// A stand-in 16:9 slide. Put your own at slides/02-flat/media/slide.png (any 16:9 image) to use it instead.
function makeFlatSlide(THREE) {
  const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
  const g = cv.getContext('2d');
  g.fillStyle = '#101218'; g.fillRect(0, 0, 1920, 1080);
  g.strokeStyle = 'rgba(108,198,255,.35)'; g.lineWidth = 2;
  for (let x = 0; x <= 1920; x += 120) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1080); g.stroke(); }
  for (let y = 0; y <= 1080; y += 120) { g.beginPath(); g.moveTo(0, y); g.lineTo(1920, y); g.stroke(); }
  g.strokeStyle = C.warm; g.lineWidth = 10; g.strokeRect(5, 5, 1910, 1070);
  g.fillStyle = C.ink; g.font = `700 110px ${FONT}`; g.fillText('A flat 16:9 slide', 120, 230);
  g.fillStyle = C.mute; g.font = `400 54px ${FONT}`;
  ['• straight lines', '• a perfect circle →', '• text in rows', '• 1920 × 1080 pixels'].forEach((s, i) => g.fillText(s, 140, 400 + i * 90));
  g.strokeStyle = C.cool; g.lineWidth = 12; g.beginPath(); g.arc(1420, 600, 300, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(1120, 600); g.lineTo(1720, 600); g.moveTo(1420, 300); g.lineTo(1420, 900); g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 8;
  return { tex, cv };
}

export default {
  title: 'A flat picture on a round screen',
  act: ACT1,
  get notes() { return `<p>The venue's own advice for slideshows: <b>16:9, about 2K high, content in the centre</b>. Show what that does.</p>
<ul><li><b>Pasted into the file</b>: the 16:9 frame placed in the middle of the dome master. It lands near the dome's zenith, curved and huge. Note how the circle and the grid bend.</li>
<li><b>Virtual screen</b>: the same picture projected as a flat cinema screen floating at ${Math.round(DOME.sweetSpot)}° up, on the venue's sweet spot. From the centre seat it looks flat again: lines straight, circle round.</li>
<li><b>Wrapped</b>: laid out by angle, like a panorama strip. Fine low down, pinches near the top.</li></ul>
<p>Press <b>P</b> (show the file) to put the dome master itself on screen while you switch modes.</p>`; },
  params: {
    mode: { type: 'select', label: 'How it gets onto the dome', options: [{ value: 'paste', label: 'Pasted into the file' }, { value: 'screen', label: 'Virtual screen' }, { value: 'wrap', label: 'Wrapped by angle' }], value: 'paste' },
    size: { type: 'range', label: 'Size', min: 20, max: 140, step: 1, value: 70, unit: '°' },
    el: { type: 'range', label: 'Elevation (screen, wrap)', min: 0, max: 70, step: 1, value: Math.round(DOME.sweetSpot), unit: '°' },
    grid: { type: 'toggle', label: 'Room grid', value: true },
  },

  video({ THREE, comp, view, base }) {
    const flat = makeFlatSlide(THREE);
    const img = new Image();
    img.onload = () => { const t = new THREE.Texture(img); t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; mat.uniforms.uImg.value = t; mat.uniforms.uAspect.value = img.width / img.height; };
    img.src = base + 'media/slide.png';
    const mat = comp.material(`${NOISE_GLSL}
      uniform sampler2D uImg; uniform float uMode, uSize, uEl, uAspect;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.6);
        vec2 uv = vec2(-1.0);
        if (uMode < 0.5) {
          // the 16:9 frame placed in the centre of the master; size = fraction of the master width
          float w = uSize / 140.0 * 1.6;
          vec2 q = m / vec2(w, w / uAspect);
          uv = q * 0.5 + 0.5;
          if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) uv = vec2(-1.0);
        } else if (uMode < 1.5) {
          uv = cardUV(room, dirRoom(0.0, uEl), min(uSize, 150.0), uAspect, 0.0);
        } else {
          float h = uSize / uAspect;
          uv = vec2(azOf(room) / uSize + 0.5, (elOf(room) - uEl) / h + 0.5);
          if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) uv = vec2(-1.0);
        }
        if (uv.x >= 0.0) c = texture(uImg, uv).rgb;
        return vec4(c, 1.0);
      }`, { uImg: { value: flat.tex }, uMode: { value: 0 }, uSize: { value: 70 }, uEl: { value: DOME.sweetSpot }, uAspect: { value: 16 / 9 } });
    const inst = {
      guides: {},
      render() {
        const u = mat.uniforms;
        u.uMode.value = { paste: 0, screen: 1, wrap: 2 }[view.p('mode')] ?? 0;
        u.uSize.value = view.p('size'); u.uEl.value = view.p('el');
        inst.guides = { rings: view.p('grid') };
        return mat;
      },
      dispose() { mat.dispose(); flat.tex.dispose(); },
    };
    return inst;
  },
};
