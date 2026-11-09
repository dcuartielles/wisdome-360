// The dome compositor: everything a slide draws ends up as one square fisheye master.
//   pass 1  slide shader  -> rtMaster   (per pixel: master uv -> room direction -> slideColor())
//   pass 2  final shader  -> screen     (fades, blackout, "show the file" inset)
//   or, for the laptop preview, pass 2 -> rtFinal -> inside view (a dome seen from a seat)
import * as THREE from '../vendor/three.module.min.js';
import { DOME, QUALITY, domeUniforms, syncDomeUniforms } from './dome.js';
import { DOME_GLSL } from './glsl.js';

THREE.ColorManagement.enabled = false; // values in = values out, everywhere

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const DEFAULT_SLIDE_GLSL = /* glsl */ `
vec4 slideColor(vec3 room, vec3 local, vec2 m){
  vec3 c = vec3(0.0);
  if (uCubeOn > 0.5) c = texture(uCube, toThree(room)).rgb;
  if (uEqOn > 0.5) { vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a); }
  return vec4(c, 1.0);
}`;

const MASTER_FRAG = (slideGlsl) => /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uEq; uniform float uEqOn;
uniform samplerCube uCube; uniform float uCubeOn;
${DOME_GLSL}
${slideGlsl || DEFAULT_SLIDE_GLSL}
void main(){
  vec2 m = vUv * 2.0 - 1.0;
  float r = length(m);
  if (r > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec3 local = masterToLocal(m);
  vec3 room = localToRoom(local);
  vec4 c = slideColor(room, local, m);
  vec3 vLocal = masterToLocalV(m);              // where this pixel really lands in the dome
  vec3 col = applyGuides(c.rgb, localToRoomV(vLocal), vLocal, r);
  gl_FragColor = vec4(col, 1.0);
}`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uMaster;
uniform float uFade, uPip;
${DOME_GLSL}
void main(){
  vec3 col = texture(uMaster, vUv).rgb;
  if (uPip > 0.5) {
    vec2 m = vUv * 2.0 - 1.0;
    vec3 room = localToRoomV(masterToLocalV(m));
    // the master file itself, shown flat on a virtual screen at the front
    vec2 uv = cardUV(room, dirRoom(0.0, 30.0), 44.0, 1.0, 0.0);
    if (uv.x >= 0.0) {
      vec3 f = texture(uMaster, uv).rgb;
      float edge = max(max(1.0 - smoothstep(0.0, 0.006, uv.x), smoothstep(0.994, 1.0, uv.x)), max(1.0 - smoothstep(0.0, 0.006, uv.y), smoothstep(0.994, 1.0, uv.y)));
      col = mix(f * 0.95 + 0.03, vec3(1.0, 0.85, 0.3), edge);
    }
  }
  if (length(vUv * 2.0 - 1.0) > 1.0) col = vec3(0.0);
  gl_FragColor = vec4(col * uFade, 1.0);
}`;

const INSIDE_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform sampler2D uMaster;
${DOME_GLSL}
void main(){
  vec3 d = normalize(vDir);
  vec3 room = vec3(d.x, -d.z, d.y);           // three -> room
  vec3 local = roomToLocalV(room);              // the real dome
  float th = acos(clamp(local.z, -1.0, 1.0));
  vec2 m = localToMasterV(local);               // where the venue takes this point from in the file
  vec3 col;
  if (th <= uOpening * 0.5 && length(m) <= 1.0) {
    col = texture(uMaster, m * 0.5 + 0.5).rgb;
  } else {
    // the room below the dome: dark seats, a faint floor grid
    float el = elOf(room);
    col = vec3(0.018, 0.016, 0.02) + 0.02 * smoothstep(-40.0, 0.0, el);
    if (el < -2.0) {
      vec2 p = room.xy / max(0.001, -room.z) * 1.6;
      vec2 g = abs(fract(p) - 0.5);
      col += vec3(0.03) * (1.0 - smoothstep(0.0, 0.03, min(g.x, g.y))) * smoothstep(-90.0, -10.0, el);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export class Compositor {
  constructor(canvas, { res = DOME.res, view = 'master', viewSize } = {}) {
    this.res = res;
    this.view = view;
    this.canvas = canvas;
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.setPixelRatio(1);
    r.autoClear = true;
    this.renderer = r;
    this.size = view === 'inside' ? (viewSize || [1280, 720]) : [res, res];
    r.setSize(this.size[0], this.size[1], false);

    const rtOpts = { depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.rtMaster = new THREE.WebGLRenderTarget(res, res, rtOpts);
    this.rtFinal = new THREE.WebGLRenderTarget(res, res, { ...rtOpts, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });

    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadGeo = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(this.quadGeo);
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);

    this.shared = {
      ...domeUniforms(),
      uTime: { value: 0 },
      uGuides: { value: new THREE.Vector4(0, 0, 0, 0) },
      uGuideVenue: { value: 0 },
    };
    this.shared.uBand.value = new THREE.Vector3();
    syncDomeUniforms(this.shared);
    this.emptyCube = new THREE.WebGLCubeRenderTarget(4).texture;
    this.emptyTex = new THREE.DataTexture(new Uint8Array(4), 1, 1); this.emptyTex.needsUpdate = true;

    this.finalMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FINAL_FRAG, depthTest: false, depthWrite: false,
      uniforms: { ...this.shared, uMaster: { value: this.rtMaster.texture }, uFade: { value: 1 }, uPip: { value: 0 } },
    });

    // inside view: a sphere around a camera at the centre of the room
    this.insideScene = new THREE.Scene();
    this.insideMat = new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: INSIDE_FRAG, side: THREE.BackSide, depthWrite: false,
      uniforms: { ...this.shared, uMaster: { value: this.rtFinal.texture } },
    });
    this.insideScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 96, 64), this.insideMat));
    this.insideCam = new THREE.PerspectiveCamera(95, this.size[0] / this.size[1], 0.1, 100);
    this.look = { az: 0, el: 32 };
  }

  /** a material for pass 1. glsl defines vec4 slideColor(vec3 room, vec3 local, vec2 m) */
  material(glsl, uniforms = {}) {
    return new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: MASTER_FRAG(glsl), depthTest: false, depthWrite: false,
      uniforms: {
        ...this.shared,
        uEq: { value: this.emptyTex }, uEqOn: { value: 0 },
        uCube: { value: this.emptyCube }, uCubeOn: { value: 0 },
        ...uniforms,
      },
    });
  }

  /** a cube capture of a three.js scene from the centre of the room. 5 faces (the floor face is never seen). */
  cube(size = QUALITY.cube) {
    const target = new THREE.WebGLCubeRenderTarget(size, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    const cam = new THREE.CubeCamera(0.05, 2000, target);
    const renderer = this.renderer;
    return {
      target, camera: cam, texture: target.texture,
      render(scene) {
        cam.updateMatrixWorld();
        if (cam.coordinateSystem !== renderer.coordinateSystem) { cam.coordinateSystem = renderer.coordinateSystem; cam.updateCoordinateSystem(); }
        const faces = cam.children;
        const gm = target.texture.generateMipmaps;
        target.texture.generateMipmaps = false;
        for (const i of [0, 1, 2, 4, 5]) {
          if (i === 5) target.texture.generateMipmaps = gm;
          renderer.setRenderTarget(target, i);
          renderer.render(scene, faces[i]);
        }
        renderer.setRenderTarget(null);
      },
      dispose() { target.dispose(); },
    };
  }

  setGuides(g) {
    this.shared.uGuides.value.set(g.rings ? 1 : 0, g.band ? 1 : 0, g.sweet ? 1 : 0, g.rim ? 1 : 0);
    this.shared.uGuideVenue.value = g.venue ? 1 : 0;
  }
  /** after setProjection(): push the new geometry into every shader */
  syncDome() { syncDomeUniforms(this.shared); }

  render(mat, { fade = 1, pip = false } = {}) {
    const r = this.renderer;
    this.quad.material = mat;
    r.setRenderTarget(this.rtMaster);
    r.render(this.quadScene, this.quadCam);

    this.finalMat.uniforms.uFade.value = fade;
    this.finalMat.uniforms.uPip.value = pip ? 1 : 0;
    this.quad.material = this.finalMat;
    if (this.view === 'inside') {
      r.setRenderTarget(this.rtFinal);
      r.render(this.quadScene, this.quadCam);
      r.setRenderTarget(null);
      const { az, el } = this.look;
      const d = [Math.cos(el * Math.PI / 180) * Math.sin(az * Math.PI / 180), Math.cos(el * Math.PI / 180) * Math.cos(az * Math.PI / 180), Math.sin(el * Math.PI / 180)];
      this.insideCam.position.set(0, 0, 0);
      this.insideCam.up.set(0, 1, 0);
      this.insideCam.lookAt(d[0], d[2], -d[1]);
      r.render(this.insideScene, this.insideCam);
    } else {
      r.setRenderTarget(null);
      r.render(this.quadScene, this.quadCam);
    }
  }

  resizeView(w, h) {
    this.size = [w, h];
    this.renderer.setSize(w, h, false);
    this.insideCam.aspect = w / h;
    this.insideCam.updateProjectionMatrix();
  }
}

export { THREE };
