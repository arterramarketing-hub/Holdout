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
// The fight's dice are Math.random. three.js rolls it for every mesh, material and geometry it makes (their uuids), and the
// view makes those lazily — so a page's first battle used to roll ~580 of the fight's dice that later battles did not.
// Everything the view does runs inside this fence, where Math.random is the view's own dice for the duration.
const VIEW_DICE = () => fxRand(0, 1);
function viewFenced(fn, ...args) {
  const fight = Math.random;
  if (fight === VIEW_DICE) return fn(...args);   // already inside
  Math.random = VIEW_DICE;
  try { return fn(...args); } finally { Math.random = fight; }
}
function loadThree() {
  threeReady = import(THREE_URL)
    .then(m => { THREE = m; viewFenced(initView); VIEW.ready = true; })
    .catch(err => { VIEW.failed = true; console.error('three.js failed to load', err); });
  return threeReady;
}

