// ============================================================ UTILS
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const lerp = (a, b, t) => a + (b - a) * t;
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
const SYL_A = ['Var','Kess','Dro','Mal','Ren','Tav','Bru','Osk','Jun','Pik','Ash','Vex','Cor','Dan','Fenn','Gray','Hal','Rook','Sable','Wren'];
const SYL_B = ['o','a','ik','en','ar','is','ek','um','ir','as','on','ey'];
function makeName(taken) {
  for (let i = 0; i < 40; i++) {
    const n = SYL_A[randi(0, SYL_A.length - 1)] + SYL_B[randi(0, SYL_B.length - 1)];
    if (!taken.includes(n)) return n;
  }
  return SYL_A[randi(0, SYL_A.length - 1)] + '-' + randi(2, 99);
}
const HUES = [88, 45, 190, 20, 280, 145, 330, 210];
const slotColor = i => `hsl(${HUES[i % 8]},55%,62%)`;
const slotDark  = i => `hsl(${HUES[i % 8]},45%,38%)`;

