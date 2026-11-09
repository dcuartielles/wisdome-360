import { ACT6, header, labEls } from '../_lab.js';
import { DOME } from '../../lib/dome.js';
import { C } from '../_common.js';
import { followClock } from '../../lib/media.js';

// Two pieces of real fulldome work, chained (Waiting Far Away is commented out: put the file in media/ and uncomment it to make three): Next plays the next one, then moves on.
const CLIPS = [
  { file: 'paranal-timelapse.mp4', title: 'Paranal fulldome time-lapse', look: 'look for: the sky turning overhead · stillness · a real horizon',
    credit: 'ESO/S. Brunier · CC BY 4.0', page: 'eso.org/public/videos/brunier_paranal_fd' },
  { file: 'orion-flight.mp4', title: 'Flight through the Orion Nebula', look: 'look for: forward travel · scale · a crossfade between two "worlds"',
    credit: 'NASA, ESA, F. Summers, G. Bacon, Z. Levay, J. DePasquale, L. Hustak, L. Frattare, M. Robberto, M. Gennaro (STScI), R. Hurt (Caltech/IPAC) · music CC BY-SA', page: 'esahubble.org/videos/flight_through_orion_vis' },
  //   { file: 'waiting-far-away.mp4', title: 'Waiting Far Away', look: 'look for: story without a frame · narration leads the eye · pacing',
  //     credit: 'Charles Hayden Planetarium, Museum of Science, Boston · visuals W. Sylvester, J. Fletcher · CC BY-ND 4.0', page: 'eso.org/public/videos/waitingfaraway' },
];

function current(view, t) {
  const presses = view.presses('step');
  const i = Math.min(CLIPS.length - 1, presses.length);
  const anchor = presses.length ? presses[Math.min(presses.length, CLIPS.length - 1) - 1] : t - view.t();
  return { i, sec: Math.max(0, t - anchor) };
}

export default {
  title: 'Watch: real fulldome pieces',
  act: ACT6,
  steps: CLIPS.length - 1,
  get notes() { return `<p>Real dome pieces, chained: <b>Next</b> plays the next one; after the last, Next moves on. Before each, read out the "look for" line, and afterwards ask which of the nine lessons they saw.</p>
<ol><li><b>Paranal fulldome time-lapse</b> (ESO/S. Brunier, 1:33): the Milky Way turning over a real horizon. Overhead as an event, vection, the stillness of a held shot.</li>
<li><b>Flight through the Orion Nebula</b> (NASA/ESA/STScI, 4:34): forward travel through real data, scale, a crossfade between visible and infrared — two worlds in one place.</li>
<li><b>Waiting Far Away</b> (Charles Hayden Planetarium, Boston, distributed by ESO, 11:23): a narrated story. How does it lead the eye without a frame? How long are its shots? Licence: CC BY-ND, exhibition allowed, <b>show its credits after the screening</b>, no edits.</li></ol>
<p><b>Level the sky</b>: these were made for level planetarium domes. Off (default) plays them as the venue would, straight onto the tilted dome, so their zenith lands ${90 - DOME.venueTilt}° up in front. On re-projects them so their horizon is the room's horizon — compare both: it is the tilt lesson again.</p>
<p>Files: download the three "Fulldome Preview" MP4s into <code>slides/49b-fulldome-showcase/media/</code> (names and links in the README there). Until a file is in place the slide shows where to get it. Sound plays on the audio page (stereo to L/R, a little to C).</p>`; },
  params: {
    level: { type: 'toggle', label: 'Level the sky (undo the tilt)', value: false },
    credits: { type: 'toggle', label: 'Credit line', value: true },
    sound: { type: 'toggle', label: 'Sound', value: true },
    vol: { type: 'range', label: 'Volume', min: 0, max: 1.5, step: 0.05, value: 0.8 },
  },
  video({ THREE, comp, AngleCanvas, view, base }) {
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.crossOrigin = 'anonymous'; video.preload = 'auto';
    const tex = new THREE.VideoTexture(video);
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    let cur = -1, ok = false;
    video.addEventListener('loadeddata', () => { ok = true; });
    video.addEventListener('error', () => { ok = false; });
    const txt = new AngleCanvas(2048);
    const draw = (i) => {
      const c = CLIPS[i];
      txt.clear();
      if (!ok) {
        header(txt, `${i + 1} / ${CLIPS.length} · ${c.title}`, c.look);
        const S = labEls().centre;   // under the header, on the sweet spot
        txt.text('waiting for the file', 0, S + 4, { size: 2.0, weight: 700, color: C.warm })
          .text(`slides/49b-fulldome-showcase/media/${c.file}`, 0, S, { size: 1.3, weight: 500, color: C.ink })
          .text(`download the "Fulldome Preview" MP4 from ${c.page}`, 0, S - 3, { size: 1.1, weight: 450, color: C.mute });
      } else {
        txt.text(`${i + 1} / ${CLIPS.length} · ${c.title}`, 0, 9.5, { size: 1.15, weight: 700, color: C.ink })
          .text(c.credit, 0, 7, { size: 0.8, weight: 450, color: '#c9ccd2' });
      }
      txt.commit();
    };
    let drawnOk = null;
    const mat = comp.material(`
      uniform sampler2D uVid, uTxt; uniform float uLevel, uOk, uCred, uAspect;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec2 uv = m * 0.5 + 0.5;                         // as is: the file's centre = the dome's zenith
        if (uLevel > 0.5) {                              // re-project: the file's centre = straight up in the room
          float th = acos(clamp(room.z, -1.0, 1.0)) / (PI * 0.5);
          float a = atan(room.x, room.y);
          vec2 q = vec2(sin(a), -cos(a)) * th;
          uv = q * 0.5 + 0.5;
          if (th > 1.0) uv = vec2(-1.0);
        }
        // a 16:9 "preview" file holds the fisheye circle in its middle: use the centre square
        vec3 c = vec3(0.0);
        if (uOk > 0.5 && uv.x >= 0.0 && length(uv * 2.0 - 1.0) <= 1.0) c = texture(uVid, vec2(0.5 + (uv.x - 0.5) / max(uAspect, 1.0), uv.y)).rgb;
        if (uOk < 0.5) c = vec3(0.012, 0.014, 0.02);
        vec4 e = sampleEq(uTxt, room);
        float show = uOk > 0.5 ? uCred : 1.0;
        c = mix(c * (1.0 - 0.5 * e.a * show), e.rgb, e.a * show);
        return vec4(c, 1.0);
      }`, { uVid: { value: tex }, uTxt: { value: txt.texture }, uLevel: { value: 0 }, uOk: { value: 0 }, uCred: { value: 1 }, uAspect: { value: 1 } });
    video.addEventListener('loadedmetadata', () => { if (video.videoWidth) mat.uniforms.uAspect.value = video.videoWidth / video.videoHeight; });
    return {
      render(t) {
        const { i, sec } = current(view, t);
        if (i !== cur) { cur = i; ok = false; drawnOk = null; video.src = base + 'media/' + CLIPS[i].file; video.load(); }
        if (ok !== drawnOk) { drawnOk = ok; draw(i); }
        if (ok) {
          const d = video.duration;
          if (d && isFinite(d) && sec < d) followClock(video, sec);
          else if (d && sec >= d && !video.paused) video.pause();   // hold the last frame at the end
        }
        const u = mat.uniforms;
        u.uOk.value = ok ? 1 : 0; u.uLevel.value = view.p('level') ? 1 : 0; u.uCred.value = view.p('credits') ? 1 : 0;
        return mat;
      },
      dispose() { video.pause(); video.removeAttribute('src'); video.load(); tex.dispose(); mat.dispose(); txt.dispose(); },
    };
  },
  audio({ group, ctx, view, base }) {
    const v = document.createElement('video');
    v.playsInline = true; v.crossOrigin = 'anonymous'; v.preload = 'auto';
    const src = ctx.createMediaElementSource(v);
    const split = ctx.createChannelSplitter(2);
    const gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(gain).connect(split);
    const gL = ctx.createGain(), gR = ctx.createGain(), gC = ctx.createGain(); gC.gain.value = 0.35;
    split.connect(gL, 0).connect(group.channel(0));
    split.connect(gR, 1).connect(group.channel(1));
    split.connect(gC, 0); split.connect(gC, 1); gC.connect(group.channel(2));
    let cur = -1, ready = false;
    v.addEventListener('loadeddata', () => { ready = true; });
    return {
      update(t) {
        const { i, sec } = current(view, t);
        if (i !== cur) { cur = i; ready = false; v.src = base + 'media/' + CLIPS[i].file; v.load(); }
        const on = view.p('sound') && ready && v.duration && sec < v.duration;
        if (ready && v.duration && sec < v.duration) followClock(v, sec); else if (!v.paused) v.pause();
        gain.gain.setTargetAtTime(on ? view.p('vol') : 0, ctx.currentTime, 0.1);
      },
      dispose() { v.pause(); v.removeAttribute('src'); v.load(); src.disconnect(); },
    };
  },
};
