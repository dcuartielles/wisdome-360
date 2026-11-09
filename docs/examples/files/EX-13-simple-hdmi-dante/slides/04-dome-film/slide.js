// ═════════════════════════════════════════════════════════════════════════════════════════════
// DEMO SLIDE: A DOME MASTER FILM, FULL DOME
// Plays a finished dome master (a square fisheye film, rendered at 160° for Wisdome) over the
// whole dome, exactly as the venue's own player would, with its sound.
// Put your film in this slide's media/ folder as film.mp4 (H.264) or film.webm.
// The film is played from the shared clock: every page (picture, sound, presenter preview)
// shows the same moment, and Restart (R) starts it again from the beginning.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { ACT_SHOW, C } from '../_common.js';
import { followClock } from '../../lib/media.js';

// The files this slide looks for, in order. The first one that loads is used.
const FILES = ['film.mp4', 'film.webm', 'sample-dome.webm'];

/** open the first file in FILES that exists; calls onReady(video) when it can play */
function openFilm(base, onReady, onNone) {
  const v = document.createElement('video');
  v.playsInline = true; v.crossOrigin = 'anonymous'; v.preload = 'auto';
  let k = 0;
  v.addEventListener('error', () => { k++; if (k < FILES.length) v.src = base + 'media/' + FILES[k]; else onNone?.(); });
  v.addEventListener('loadeddata', () => onReady?.(v, FILES[k]), { once: true });
  v.src = base + 'media/' + FILES[0];
  return v;
}

export default {
  title: 'A dome master film',
  act: ACT_SHOW,
  notes: `<p>A finished dome master, full dome. Press <b>R</b> to start it from the beginning.</p>
<p>Your film: <code>slides/04-dome-film/media/film.mp4</code>, square, rendered as a 160° fisheye (see the Wisdome site: delivery spec).</p>`,
  params: {
    sound: { type: 'toggle', label: 'Film sound', value: true },
    // 'stereo': the file's left/right go to L/R (and a little to C). '51': the file has 6 channels
    // in the order L R C LFE Ls Rs, and each goes to its own speaker.
    layout: { type: 'select', label: 'Film sound is…', options: [{ value: 'stereo', label: 'stereo' }, { value: '51', label: '5.1 (6 channels)' }], value: 'stereo' },
    vol: { type: 'range', label: 'Volume', min: 0, max: 1.5, step: 0.05, value: 1 },
    label: { type: 'toggle', label: 'File name on the dome', value: false },
  },

  video({ THREE, comp, AngleCanvas, view, base }) {
    const ac = new AngleCanvas(2048);
    let ready = false;
    const v = openFilm(base,
      (vid, name) => { ready = true; ac.clear().text(name, 0, 6, { size: 1.3, color: C.mute, weight: 550 }).commit(); },
      () => { ac.clear().text('No film yet: put film.mp4 in slides/04-dome-film/media/', 0, 20, { size: 1.8, color: C.warm, weight: 650 }).commit(); });
    v.muted = true;                                   // the picture page never makes sound
    const tex = new THREE.VideoTexture(v);
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;

    // m is the pixel's position in the square master file (-1..1): the film IS a master, so we
    // simply read it there. Nothing to bend: the venue's projection does the rest.
    const mat = comp.material(`
      uniform sampler2D uVid; uniform float uReady, uLabel;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = uReady > 0.5 ? texture(uVid, m * 0.5 + 0.5).rgb : vec3(0.0);
        vec4 e = sampleEq(uEq, room);
        return vec4(mix(c, e.rgb, e.a * uLabel), 1.0);
      }`, { uVid: { value: tex }, uEq: { value: ac.texture }, uReady: { value: 0 }, uLabel: { value: 0 } });
    return {
      render() {
        if (ready) followClock(v, view.t());       // keep the film at the shared time (seconds since the slide started)
        mat.uniforms.uReady.value = ready ? 1 : 0;
        mat.uniforms.uLabel.value = (!ready || view.p('label')) ? 1 : 0;
        return mat;
      },
      dispose() { v.pause(); v.removeAttribute('src'); v.load(); tex.dispose(); mat.dispose(); ac.dispose(); },
    };
  },

  // The sound page plays its own copy of the same file, at the same shared time, and routes the
  // file's channels to the speakers. group.channel(i) is speaker i: 0 L, 1 R, 2 C, 3 LFE, 4 Ls, 5 Rs.
  audio({ group, ctx, view, base }) {
    let ready = false;
    const v = openFilm(base, () => { ready = true; });
    const src = ctx.createMediaElementSource(v);
    const gain = ctx.createGain(); gain.gain.value = 0;
    const split = ctx.createChannelSplitter(6);
    src.connect(gain).connect(split);
    // Two routings, switched by the "Film sound is…" menu (each is a set of gains we fade up or down).
    // stereo: file L → L, file R → R, and both a little to C so people in the middle hear a centre
    const stL = ctx.createGain(), stR = ctx.createGain(), stC = ctx.createGain();
    split.connect(stL, 0); split.connect(stR, 1); split.connect(stC, 0); split.connect(stC, 1);
    stL.connect(group.channel(0)); stR.connect(group.channel(1)); stC.connect(group.channel(2));
    const stereo = [stL, stR, stC], stLevel = [1, 1, 0.35];
    // 5.1: file channel i → speaker i
    const surround = [0, 1, 2, 3, 4, 5].map((i) => { const g = ctx.createGain(); g.gain.value = 0; split.connect(g, i); g.connect(group.channel(i)); return g; });
    return {
      update() {
        const t = view.t();
        if (ready) followClock(v, t);              // same moment as the picture page
        gain.gain.setTargetAtTime(view.p('sound') && ready ? view.p('vol') : 0, ctx.currentTime, 0.1);
        const is51 = view.p('layout') === '51';
        stereo.forEach((g, i) => g.gain.setTargetAtTime(is51 ? 0 : stLevel[i], ctx.currentTime, 0.05));
        surround.forEach((g) => g.gain.setTargetAtTime(is51 ? 1 : 0, ctx.currentTime, 0.05));
      },
      dispose() { v.pause(); v.removeAttribute('src'); v.load(); src.disconnect(); },
    };
  },
};
