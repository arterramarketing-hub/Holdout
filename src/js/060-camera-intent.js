// ============================================================ CAMERA INTENT
// The simulation only says how the camera should feel (shake, punch, snap); the 3D chase
// camera in the VIEW LAYER reads these. yaw 0 looks north, toward the enemy front.
const cam = { yaw: 0, shake: 0, punch: 0, snap: true, nudge: 0, nudgeT: 0 };
function camTarget() {
  const c = soldiers[state.controlled];
  return (c && c.alive) ? c : soldiers.find(s => s.alive) || c;
}

