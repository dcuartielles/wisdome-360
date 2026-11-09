import { ACT3, C } from '../_common.js';

const CLIPS = {
  drift: { src: '/outputs/06-examples/EX-01-blender/EX-01_drift_1024x1024_30fps.mp4', label: 'EX-01 · Drift · Blender + Cycles, fisheye camera · Track A' },
  tide: { src: '/outputs/06-examples/EX-02-python-numpy/EX-02_tide_2048x2048_30fps.mp4', label: 'EX-02 · Tide · Python + numpy, pixel by pixel · Track A' },
  flight: { src: '/outputs/06-examples/EX-10-greenscreen-footage/EX-10_flight_2048x2048_30fps.mp4', label: 'EX-10 · Flight · green-screen footage, keyed and flown · Any track' },
};

export default {
  title: 'Our examples: rendered (Track A)',
  act: ACT3,
  notes: `<p>Three of the examples, played as they would be on Friday: a <b>dome master movie</b>, straight to the projectors with no conversion.</p>
<ul><li><b>Drift</b>: Blender with an equidistant fisheye camera at 160°, the venue's field (re-rendered for Wisdome). About 190 lines of Python build the whole scene.</li>
<li><b>Tide</b>: no 3D software at all. numpy computes the colour of every pixel from its angle.</li>
<li><b>Flight</b>: real footage. A stock dove shot on green screen, keyed, hung on a card in the room and flown once round the audience. The answer to "can we use our own video?"</li></ul>
<p>Press <b>P</b> to show the file: the square master is what the students hand in.</p>`,
  params: {
    clip: { type: 'select', label: 'Clip', options: [{ value: 'drift', label: 'EX-01 Drift' }, { value: 'tide', label: 'EX-02 Tide' }, { value: 'flight', label: 'EX-10 Flight' }], value: 'drift' },
    label: { type: 'toggle', label: 'Caption', value: true },
  },
  video({ THREE, comp, AngleCanvas, view }) {
    const video = document.createElement('video');
    video.muted = true; video.loop = true; video.playsInline = true; video.crossOrigin = 'anonymous';
    const tex = new THREE.VideoTexture(video);
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const ac = new AngleCanvas(2048);
    let cur = null;
    const load = (k) => {
      cur = k; video.src = CLIPS[k].src; video.play().catch(() => {});
      ac.clear().text(CLIPS[k].label, 0, 6, { size: 1.3, color: C.mute, weight: 550 }).commit();
    };
    const mat = comp.material(`
      uniform sampler2D uVid; uniform float uLabel;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = texture(uVid, m * 0.5 + 0.5).rgb;     // the master, as is
        vec4 e = sampleEq(uEq, room);
        return vec4(mix(c, e.rgb, e.a * uLabel), 1.0);
      }`, { uVid: { value: tex }, uEq: { value: ac.texture }, uLabel: { value: 1 } });
    return {
      render() {
        if (view.p('clip') !== cur) load(view.p('clip'));
        mat.uniforms.uLabel.value = view.p('label') ? 1 : 0;
        return mat;
      },
      dispose() { video.pause(); video.removeAttribute('src'); video.load(); tex.dispose(); mat.dispose(); ac.dispose(); },
    };
  },
};
