import { ACT3, C, NOISE_GLSL } from '../_common.js';
import { DOME } from '../../lib/dome.js';

function testCard(THREE) {
  const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const g = c.getContext('2d');
  g.fillStyle = '#10141c'; g.fillRect(0, 0, 1920, 1080);
  g.strokeStyle = '#c8ccd4'; g.lineWidth = 4;
  for (let i = 0; i <= 16; i++) { const x = i * 1919 / 16; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1080); g.stroke(); }
  for (let j = 0; j <= 9; j++) { const y = j * 1079 / 9; g.beginPath(); g.moveTo(0, y); g.lineTo(1920, y); g.stroke(); }
  g.strokeStyle = '#ff7e4d'; g.lineWidth = 16; g.strokeRect(8, 8, 1904, 1064);
  g.strokeStyle = '#ffd34d'; g.lineWidth = 10; g.beginPath(); g.arc(960, 540, 160, 0, 7); g.stroke();
  g.font = '800 120px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f2f5fa';
  g.fillText('IS THIS STRAIGHT?', 960, 250);
  g.font = '500 64px Inter, system-ui, sans-serif'; g.fillStyle = '#8fa3be'; g.fillText('a 16:9 slide · grid · circle', 960, 840);
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8;
  return t;
}

export default {
  title: 'Flat pictures in the dome',
  act: ACT3,
  get notes() { return `<p>How to show a flat picture (a slide, a photo, a 16:9 film) so the audience sees it <b>flat and straight</b>.</p>
<ul><li><b>Pasted in the middle</b>: the slide dropped into the centre of the dome master, the way an image editor would. It hangs ${90 - DOME.venueTilt}° up in front, bent: the circle is an egg, the grid bulges.</li>
<li><b>Pasted at the sweet spot</b>: moved down in the file to where the sweet spot is. Better place, still bent: the file is a fisheye, so a flat rectangle in it is not a flat rectangle on the dome.</li>
<li><b>Through the fisheye</b>: the slide is a virtual screen in the room, photographed by the dome's own fisheye ("apply the fisheye lens"). From the seats it is a rectangle, the circle is round, the lines are straight. The file looks bent; the dome looks right.</li></ul>
<p>Students' tools for it are in <code>outputs/06-examples/EX-08-flat-to-dome/</code>:</p>
<ul><li><code>flat2dome.html</code>: drop in a picture or video, export a master.</li>
<li><code>flat2dome.py</code>: stills and frame sequences.</li>
<li>An <b>ffmpeg</b> one-liner for video files: <code>v360=input=flat:output=fisheye:ih_fov=60:iv_fov=36:h_fov=${DOME.fisheyeFov}:v_fov=${DOME.fisheyeFov}:pitch=${Math.round(90 - DOME.tilt - DOME.sweetSpot)}</code>, where pitch = 90 − ${DOME.tilt} − elevation, and h_fov/v_fov = ${DOME.fisheyeFov} because the venue spreads the file over ${DOME.venueFov}°.</li>
<li>Recipes for Blender and TouchDesigner.</li></ul>
<p>Rule of thumb: 60° wide, centred on the sweet spot (venue 40°, about ${Math.round(DOME.sweetSpot)}° up). Press <b>P</b> (picture-in-picture) to show the file next to the dome view.</p>`; },
  params: {
    method: { type: 'select', label: 'Method', options: [{ value: 'lens', label: 'Through the fisheye' }, { value: 'middle', label: 'Pasted in the middle' }, { value: 'sweet', label: 'Pasted at the sweet spot' }], value: 'middle' },
    width: { type: 'range', label: 'Width', min: 20, max: 120, step: 1, value: 60, unit: '°' },
    elev: { type: 'range', label: 'Centre height (fisheye)', min: 0, max: 60, step: 0.5, value: Math.round(DOME.sweetSpot), unit: '°' },
    zone: { type: 'toggle', label: 'Show the zone', value: true },
  },
  video({ THREE, comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    // the picture (60° wide, 16:9) sits on the sweet spot and fills most of the comfortable zone (about S − 18 … S + 18):
    // title, subtitle and the method's label just above it, the "try" line low at the front, under it
    const S = DOME.sweetSpot, TOP = S + 18;
    ac.text('Flat pictures in the dome', 0, TOP + 7.2, { size: 2.1, weight: 800, color: C.ink })
      .text('put the slide on a screen in the room, and film that screen with the fisheye', 0, TOP + 4.3, { size: 1.05, weight: 500, color: C.warm })
      .text('try: pasted in the middle → pasted at the sweet spot → through the fisheye', 0, DOME.band[0] + 10, { size: 1.0, weight: 500, color: C.mute });
    ac.commit();
    const lab = new AngleCanvas(2048);
    const tex = testCard(THREE);
    const mat = comp.material(`${NOISE_GLSL}
      uniform sampler2D uImg, uLab;
      uniform float uMethod, uW, uEl, uAspect, uSweetY;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.5) + stars(room) * 0.25;
        vec2 uv = vec2(-1.0);
        if (uMethod < 0.5) {
          uv = cardUV(room, dirRoom(0.0, uEl), uW, uAspect, 0.0);     // a flat screen in the room
        } else {
          // naive: a rectangle in the FILE, sized as if the fisheye were flat
          vec2 centre = uMethod < 1.5 ? vec2(0.0) : vec2(0.0, uSweetY);
          vec2 hs = vec2(uW / 180.0, uW / 180.0 / uAspect);
          vec2 q = (m - centre) / hs;
          if (abs(q.x) <= 1.0 && abs(q.y) <= 1.0) uv = q * 0.5 + 0.5;
        }
        if (uv.x >= 0.0) c = texture(uImg, uv).rgb;
        vec4 l = sampleEq(uLab, room); c = mix(c, l.rgb, l.a);
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uLab: { value: lab.texture }, uImg: { value: tex }, uMethod: { value: 0 }, uW: { value: 60 }, uEl: { value: DOME.sweetSpot }, uAspect: { value: 16 / 9 }, uSweetY: { value: -(90 - DOME.tilt - DOME.sweetSpot) / (DOME.fisheyeFov / 2) } });
    let last = '';
    const inst = {
      guides: { band: 1, sweet: 1 },
      render() {
        const u = mat.uniforms, meth = view.p('method');
        u.uMethod.value = { lens: 0, middle: 1, sweet: 2 }[meth];
        u.uW.value = view.p('width'); u.uEl.value = view.p('elev');
        const z = view.p('zone') ? 1 : 0; inst.guides.band = z; inst.guides.sweet = z;
        if (meth !== last) {
          last = meth; lab.clear();
          const txt = { lens: ['through the fisheye', 'straight from the seats', C.green], middle: ['pasted in the middle of the file', 'overhead, and bent', C.red], sweet: ['pasted at the sweet spot in the file', 'right place, still bent', C.warm] }[meth];
          lab.text(`${txt[0]}:  ${txt[1]}`, 0, TOP + 1.9, { size: 1.2, weight: 700, color: txt[2] });
          lab.commit();
        }
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); lab.dispose(); tex.dispose(); },
    };
    return inst;
  },
};
