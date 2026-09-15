// ============================================================ VIEW LAYER — three.js, Ocarina-of-Time look
// Sim units map to metres: x → X, y → Z (north is −Z), particle height z → Y.
// Characters are rigid limb pieces on joint hierarchies, the way N64 models were
// built, and every piece of every character draws through shared InstancedMesh
// batches, so the draw-call count stays flat no matter how many bodies are on the field.
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js';
const XS = 1 / 40, ZS = 0.07;
const simYaw = a => -a - Math.PI / 2;
let THREE = null, threeReady = null;
const VIEW = {
  ready: false, failed: false, renderer: null, scene: null, camera: null,
  pr: 1, prScale: 1, frameMs: 16, slowT: 0, fastT: 0,
  dyn: null, stat: null, fx: null, tex: null, kit: null, mats: null,
};
function loadThree() {
  threeReady = import(THREE_URL)
    .then(m => { THREE = m; initView(); VIEW.ready = true; })
    .catch(err => { VIEW.failed = true; console.error('three.js failed to load', err); });
  return threeReady;
}

