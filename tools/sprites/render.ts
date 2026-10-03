import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SPRITES } from './sprites.config';

/** A 1×1 ground tile must project to a 64 px wide diamond. */
const PX_PER_UNIT = 64 / Math.SQRT2;
/** Logical canvas size; rendered at RES× for crisp sprites. */
const SIZE = 160;
const RES = 2;
/** 30° elevation gives 2:1 diamonds. */
const ELEV = Math.PI / 6;
/** Ground origin sits this far down the image. */
const ORIGIN_Y = 0.75;

export interface RenderedSprite {
  name: string;
  rotation: number;
  dataUrl: string;
  originY: number;
  topHeight: number;
  scale: number;
}

async function renderAll(): Promise<RenderedSprite[]> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(RES);
  renderer.setSize(SIZE, SIZE);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const half = SIZE / 2 / PX_PER_UNIT;
  const camera = new THREE.OrthographicCamera(-half, half, (SIZE * ORIGIN_Y) / PX_PER_UNIT, (-SIZE * (1 - ORIGIN_Y)) / PX_PER_UNIT, 0.1, 100);
  // Grid +x maps to world +X and grid +y to world +Z when the camera sits on the (+X, +Z) diagonal.
  const d = 20;
  camera.position.set(d * Math.cos(ELEV) * Math.SQRT1_2, d * Math.sin(ELEV), d * Math.cos(ELEV) * Math.SQRT1_2);
  camera.lookAt(0, 0, 0);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b6458, 1.4));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
  sun.position.set(4, 10, 2);
  scene.add(sun);

  const loader = new GLTFLoader();
  const out: RenderedSprite[] = [];
  for (const spec of SPRITES) {
    const gltf = await loader.loadAsync(`/assets/kenney/${spec.file}`);
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = Math.min(spec.footprint / Math.max(size.x, size.z), (spec.maxHeight ?? 1.2) / size.y);
    model.scale.setScalar(s);
    const scaled = new THREE.Box3().setFromObject(model);
    const centre = scaled.getCenter(new THREE.Vector3());
    const pivot = new THREE.Group();
    model.position.set(-centre.x, -scaled.min.y, -centre.z);
    pivot.add(model);
    scene.add(pivot);
    const height = scaled.max.y - scaled.min.y;
    for (let k = 0; k < 4; k++) {
      // Grid rotation k maps offset (x, y) -> (-y, x): a turn of -90° about the vertical axis.
      pivot.rotation.y = -((k + (spec.yaw ?? 0)) * Math.PI) / 2;
      renderer.render(scene, camera);
      out.push({
        name: spec.name,
        rotation: k,
        dataUrl: renderer.domElement.toDataURL('image/png'),
        originY: ORIGIN_Y,
        topHeight: Math.round(height * Math.cos(ELEV) * PX_PER_UNIT),
        scale: 1 / RES,
      });
    }
    scene.remove(pivot);
  }
  return out;
}

Object.assign(window, { renderAll });
