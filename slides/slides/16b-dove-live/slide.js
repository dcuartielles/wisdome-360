import { ACT3, C, NOISE_GLSL } from '../_common.js';
import { DOME, FRONT_ROT, localToRoom, roomToMaster, rimElevation } from '../../lib/dome.js';
import { followClock } from '../../lib/media.js';

// EX-10's keyed dove, flown live: the footage hangs on a card in the room and the
// projection does the bending. Compare with pasting the same footage flat into the file.
const SRC = '/outputs/06-examples/EX-10-greenscreen-footage/EX-10_dove_keyed_alpha.webm';
const D = Math.PI / 180;

// a master position (0..1, y down, as the pointer arrives) -> room az/el
function masterToRoom(x, y) {
  let u = x * 2 - 1, v = 1 - y * 2;
  const a = FRONT_ROT * D; [u, v] = [u * Math.cos(a) - v * Math.sin(a), u * Math.sin(a) + v * Math.cos(a)];
  const r = Math.hypot(u, v); if (r > 1) return null;
  const th = r * (DOME.fisheyeFov / 2) * D, n = r || 1;
  const l = [Math.sin(th) * u / n, -Math.sin(th) * v / n, Math.cos(th)];
  const p = localToRoom(l);
  return { az: Math.atan2(p[0], p[1]) / D, el: Math.asin(Math.max(-1, Math.min(1, p[2]))) / D };
}

export default {
  title: 'EX-10 live: real footage, flown round the room',
  act: ACT3,
  pointer: true,
  get notes() { const S = DOME.sweetSpot; return `<p>The dove from <b>EX-10</b>: stock green-screen footage, keyed (the file has a transparent background), and flown live.</p>
<ul><li><b>Card in the room</b> (default): the clip hangs on a flat card out in the room, facing the audience, its right edge along the flight path and its top as close to the ceiling as possible. The projection bends it; from the seats it stays a bird.</li>
<li><b>Pasted flat into the file</b>: the same clip as an upright rectangle in the dome master, the way a video editor would place it. Watch it stretch near the rim and spin as it goes round: in a fisheye, "up" points at the centre of the circle, not at the ceiling.</li>
<li><b>Path</b>: <i>round the room</i> is a lap at the sweet spot in front (about ${Math.round(S)}° up), rising to about ${Math.round(rimElevation(180) + 12)}° behind, where the picture starts higher (EX-10's rendered lap is higher: 30° in front, 48° behind); <i>in front</i> sways round the sweet spot, inside the comfortable zone; <i>follow the mouse</i> lets you steer it with the mouse over the presenter preview (master view).</li>
<li><b>Size</b>: about 26° of wingspan at a card size of 30°. Over ~40° the bird is in your face (the scale lesson).</li></ul>
<p>Source clip: "Flying Dove – Free Green screen Stock Footage" by <b>UltraKey</b>, free for non-commercial use with credit. The rendered master is on "Our examples: rendered".</p>`; },
  params: {
    method: { type: 'select', label: 'Footage', options: [{ value: 'card', label: 'Card in the room' }, { value: 'flat', label: 'Pasted flat into the file' }], value: 'card' },
    path: { type: 'select', label: 'Path', options: [{ value: 'lap', label: 'Round the room' }, { value: 'front', label: 'In front' }, { value: 'mouse', label: 'Follow the mouse' }], value: 'lap' },
    speed: { type: 'range', label: 'Speed', min: -40, max: 40, step: 1, value: 12, unit: '°/s' },
    size: { type: 'range', label: 'Size of the card', min: 8, max: 60, step: 1, value: 30, unit: '°' },
    sky: { type: 'toggle', label: 'Dusk sky', value: true },
    credit: { type: 'toggle', label: 'Credit', value: true },
  },
  video({ THREE, comp, AngleCanvas, view, onStream }) {
    const video = document.createElement('video');
    video.muted = true; video.loop = true; video.playsInline = true; video.crossOrigin = 'anonymous'; video.src = SRC;
    video.play().catch(() => {});
    const tex = new THREE.VideoTexture(video);
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    tex.format = THREE.RGBAFormat;
    const ac = new AngleCanvas(2048);
    ac.text('Dove: "Flying Dove – Free Green screen Stock Footage" by UltraKey · EX-10', 0, 6, { size: 0.9, color: C.mute, weight: 500 }).commit();
    const mat = comp.material(`${NOISE_GLSL}
      uniform sampler2D uVid; uniform vec3 uC; uniform float uW, uAspect, uRoll, uFlip, uFlat, uSky, uCred; uniform vec2 uM;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = uSky > 0.5 ? houseSky(room, 1.0) * 1.2 + stars(room) * 0.5 * smoothstep(25.0, 60.0, elOf(room)) : vec3(0.0);
        vec2 uv = vec2(-1.0);
        if (uFlat < 0.5) {
          uv = cardUV(room, uC, uW, uAspect, uRoll);
        } else {
          vec2 hs = vec2(uW / 180.0, uW / 180.0 / uAspect);             // as if the fisheye were flat
          vec2 q = (m - uM) / hs;
          if (abs(q.x) <= 1.0 && abs(q.y) <= 1.0) uv = q * 0.5 + 0.5;
        }
        if (uv.x >= 0.0) {
          if (uFlip > 0.5) uv.x = 1.0 - uv.x;
          vec4 v = texture(uVid, uv);
          c = mix(c, v.rgb, v.a);
          if (uFlat > 0.5) c = mix(c, vec3(1.0, 0.36, 0.3), (1.0 - step(0.012, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)))) * 0.8);
        }
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a * uCred);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uVid: { value: tex }, uC: { value: new THREE.Vector3(0, 1, 0) }, uW: { value: 30 }, uAspect: { value: 16 / 9 },
      uRoll: { value: 0 }, uFlip: { value: 0 }, uFlat: { value: 0 }, uSky: { value: 1 }, uCred: { value: 1 }, uM: { value: new THREE.Vector2() } });
    video.addEventListener('loadedmetadata', () => { if (video.videoWidth) mat.uniforms.uAspect.value = video.videoWidth / video.videoHeight; });

    const S = DOME.sweetSpot, BACK = rimElevation(180) + 12;          // in front: the sweet spot; behind: clear of the rim
    let target = { az: 0, el: S }, pos = { az: 0, el: S }, prev = { az: 0, el: S }, head = { x: 1, y: 0 };
    onStream((msg) => { if (msg.name === 'pointer' && msg.data) { const r = masterToRoom(msg.data.x, msg.data.y); if (r) target = r; } });
    const where = (path, t) => {
      if (path === 'lap') {
        const az = view.integrate('speed');
        const k = (1 - Math.cos(az * D)) / 2;                          // 0 in front, 1 behind
        return { az, el: S + (BACK - S) * k + 3 * Math.sin(t * 2 * Math.PI / 6) };
      }
      if (path === 'front') {
        const s = view.integrate('speed') / 12;                       // 12 °/s -> one sway per ~20 s
        return { az: 45 * Math.sin(s * 2 * Math.PI / 20), el: S + 2 + 6 * Math.sin(s * 2 * Math.PI / 10) };
      }
      return null;
    };
    let lastT = null;
    return {
      render(t) {
        const u = mat.uniforms, dt = lastT === null ? 0 : Math.min(0.1, t - lastT); lastT = t;
        followClock(video, view.t());
        const p = where(view.p('path'), t);
        prev = { ...pos };
        if (p) pos = p;
        else {                                                         // follow the mouse, smoothly, by the short way round
          let daz = ((target.az - pos.az + 540) % 360) - 180;
          const k = 1 - Math.exp(-dt * 1.5);
          pos = { az: pos.az + daz * k, el: pos.el + (target.el - pos.el) * k };
        }
        // heading along the motion (in degrees on the dome), smoothed so the card does not flicker
        let hx = ((pos.az - prev.az + 540) % 360 - 180) * Math.cos(pos.el * D), hy = pos.el - prev.el;
        if (Math.hypot(hx, hy) > 1e-3) { const n = Math.hypot(hx, hy); head.x += (hx / n - head.x) * 0.15; head.y += (hy / n - head.y) * 0.15; }
        const flip = head.x < 0;
        const roll = flip ? Math.atan2(-head.y, -head.x) : Math.atan2(head.y, head.x);
        u.uC.value.set(Math.cos(pos.el * D) * Math.sin(pos.az * D), Math.cos(pos.el * D) * Math.cos(pos.az * D), Math.sin(pos.el * D));
        u.uRoll.value = Math.max(-35, Math.min(35, roll / D));
        u.uFlip.value = flip ? 1 : 0;
        u.uW.value = view.p('size');
        u.uFlat.value = view.p('method') === 'flat' ? 1 : 0;
        u.uSky.value = view.p('sky') ? 1 : 0; u.uCred.value = view.p('credit') ? 1 : 0;
        // where the bird is in the file (for the "pasted flat" version)
        const [px, py] = roomToMaster(pos.az, pos.el, 1);
        const mx = px * 2 - 1, my = 1 - py * 2;
        u.uM.value.set(mx, my);
        return mat;
      },
      dispose() { video.pause(); video.removeAttribute('src'); video.load(); tex.dispose(); mat.dispose(); ac.dispose(); },
    };
  },
};
