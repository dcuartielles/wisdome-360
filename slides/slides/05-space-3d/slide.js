import { ACT1 } from '../_common.js';
import { DOME } from '../../lib/dome.js';

export default {
  title: 'A 3D space around the audience',
  act: ACT1,
  notes: `<p>A real 3D scene (three.js), captured from the centre of the room in five directions (a cube map) and turned into the fisheye. Blender, Unity, Unreal and TouchDesigner all do the same thing.</p>
<ul><li>Shapes at different distances: <b>parallax</b> while they orbit gives depth without glasses.</li>
<li>Turn <b>Orbit speed</b> up slowly and ask who feels it. Global motion is what makes people sick in a dome. Keep it slow, never roll the horizon.</li>
<li><b>Distance</b> brings the shapes in: close objects grow fast and fill the periphery.</li>
<li>The orbit is <b>tilted with the dome</b> (26°, back raised): the shapes circle at a steady height above the screen edge, so none of them sink under the rim behind the audience. A level orbit at eye height would be invisible behind us — there the picture only starts 36° up.</li></ul>`,
  params: {
    speed: { type: 'range', label: 'Orbit speed', min: -40, max: 40, step: 0.5, value: 4, unit: '°/s' },
    dist: { type: 'range', label: 'Distance', min: 0.3, max: 2, step: 0.01, value: 1 },
    wire: { type: 'toggle', label: 'Wireframe', value: false },
    floor: { type: 'toggle', label: 'Floor grid', value: true },
  },

  video({ THREE, comp, view, QUALITY }) {
    const cube = comp.cube(QUALITY.cube);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020306);
    scene.fog = new THREE.FogExp2(0x020306, 0.022);
    scene.add(new THREE.HemisphereLight(0x8fb8ff, 0x1a1006, 0.9));
    const sun = new THREE.DirectionalLight(0xffc27a, 2.2); sun.position.set(0, 4, -10); scene.add(sun);   // warm from the front
    const back = new THREE.DirectionalLight(0x6cc6ff, 1.0); back.position.set(0, 6, 10); scene.add(back);  // cool from behind

    // the orbit lies in the DOME's frame, not the room's: tilt it like the dome (back raised), so the
    // shapes keep the same height above the screen edge all the way round
    const pivot = new THREE.Group(); pivot.rotation.x = -DOME.tilt * Math.PI / 180; scene.add(pivot);
    const group = new THREE.Group(); pivot.add(group);
    const rimLocal = 90 - Math.min(DOME.opening, DOME.venueFov) / 2;   // the screen edge, in the dome's frame (10°)
    const geos = [new THREE.IcosahedronGeometry(1, 0), new THREE.TorusKnotGeometry(0.7, 0.24, 120, 16), new THREE.BoxGeometry(1.3, 1.3, 1.3), new THREE.OctahedronGeometry(1.1), new THREE.TorusGeometry(0.85, 0.3, 24, 64), new THREE.DodecahedronGeometry(1)];
    const palette = [0xffb547, 0x6cc6ff, 0xff7a3d, 0x7d8cff, 0x5be38b, 0xf2efe9];
    const meshes = [];
    const rnd = (i) => { const x = Math.sin(i * 91.17 + 7.3) * 43758.5453; return x - Math.floor(x); };
    for (let i = 0; i < 22; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: palette[i % palette.length], roughness: 0.45, metalness: 0.15, flatShading: true });
      const m = new THREE.Mesh(geos[i % geos.length], mat);
      const az = (i / 22) * Math.PI * 2 + rnd(i) * 0.3;
      const r = 5 + rnd(i + 3) * 9;
      const h = r * Math.tan((rimLocal + 5 + rnd(i + 5) * 40) * Math.PI / 180);   // 5–45° above the screen edge
      m.userData = { az, r, h, spin: (rnd(i + 9) - 0.5) * 1.2, s: 0.6 + rnd(i + 11) * 0.9 };
      m.scale.setScalar(m.userData.s);
      group.add(m); meshes.push(m);
    }
    const grid = new THREE.GridHelper(80, 40, 0x6cc6ff, 0x24304a); grid.position.y = -3; scene.add(grid);
    const starGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(3000 * 3);
    for (let i = 0; i < 3000; i++) { const u = rnd(i * 3 + 1) * 2 - 1, a = rnd(i * 3 + 2) * Math.PI * 2, s = Math.sqrt(1 - u * u); sp.set([s * Math.cos(a) * 400, Math.abs(u) * 400, s * Math.sin(a) * 400], i * 3); }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbfd4ff, size: 1.6, sizeAttenuation: false, fog: false })));

    const mat = comp.material(null, { uCube: { value: cube.texture }, uCubeOn: { value: 1 } });
    return {
      render() {
        const ts = view.t();
        group.rotation.y = -view.integrate('speed') * Math.PI / 180;
        const d = view.p('dist');
        const wire = !!view.p('wire');
        for (const m of meshes) {
          const u = m.userData;
          m.position.set(Math.sin(u.az) * u.r * d, u.h, -Math.cos(u.az) * u.r * d);
          m.rotation.set(ts * u.spin * 0.7, ts * u.spin, 0);
          m.material.wireframe = wire;
        }
        grid.visible = !!view.p('floor');
        cube.render(scene);
        return mat;
      },
      dispose() { mat.dispose(); cube.dispose(); meshes.forEach((m) => m.material.dispose()); geos.forEach((g) => g.dispose()); starGeo.dispose(); },
    };
  },
};
