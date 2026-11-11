/** Легенда Шахтино — PNG-спрайты + canvas fallback. */
import { blit, blitProp, blitTile, spr, animKey } from './sprites.js';

const C = {
  ink: '#101418',
  skin: '#f2c4a2',
  skinDk: '#d0946c',
  skinDp: '#a86c48',
  eye: '#1a120e',
  white: '#fff8f0',
  beard: '#e4bc8a',
  beardDk: '#b48450',
  beardDp: '#7a5830',
  hat: '#2c221c',
  hatHi: '#5c4032',
  red: '#c42c28',
  redDk: '#7c1818',
  coat: '#8a5228',
  coatHi: '#c88848',
  coatLt: '#e0a868',
  coatDk: '#5a3218',
  fur: '#f4e6cc',
  furDk: '#c8b492',
  gold: '#e8b43c',
  goldHi: '#ffe090',
  goldDk: '#a07018',
  foam: '#fff6e6',
  foamHi: '#ffffff',
  foamDk: '#e2d2b0',
  foamSh: '#c8b890',
  boot: '#ddd4c4',
  bootDk: '#8e8578',
  bootDp: '#3a342c',
  pants: '#3a2c22',
  pantsDk: '#241810',
  wood: '#7a4c28',
  woodHi: '#c48a4c',
  woodDk: '#4a2c16',
  hop: '#5a8228',
  hopHi: '#b4d25c',
  hopLt: '#d8ec90',
  hopDk: '#2e4816',
  iron: '#525a64',
  ironHi: '#d0d8e0',
  ironMd: '#8a949e',
  ironDk: '#2a3036',
  cape: '#721830',
  capeHi: '#a82840',
  capeDk: '#3c101c',
  tunic: '#7c3040',
  tunicHi: '#b05060',
  tunicDk: '#4a1824',
  suit: '#2a5830',
  suitHi: '#6aa848',
  suitDk: '#163018',
  stripe: '#eef6d8',
  cap: '#1a1c18',
  capHi: '#3a3c34',
  robe: '#3a4e64',
  robeHi: '#7e98b0',
  robeDk: '#243444',
  apron: '#c8d0d4',
  apronDk: '#8a98a0',
  greyBeard: '#e4e8ea',
  greyDk: '#a8b0b4',
  bottle: '#3a8a48',
  bottleDk: '#1e5030',
  bottleHi: '#8ed48a',
  glass: '#9ec8d8',
  water: '#0c1820',
  waterHi: '#1a3848',
  iceLip: '#9ec0d0',
  iceHi: '#d5e8f0',
  crack: '#0e161e',
  crackHi: 'rgba(190,220,232,.55)',
};

const TILE = 32;
const VIEW_W = 960;
const VIEW_H = 540;

function px(ctx, x, y, w, h, c) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = c;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

function hash(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return (n ^ (n >>> 16)) >>> 0;
}

function vnoise(ix, iy, cell, salt) {
  const x = ix / cell;
  const y = iy / cell;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  let fx = x - x0;
  let fy = y - y0;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const h = (ax, ay) => (hash(ax + salt, ay + salt * 3) & 1023) / 1023;
  const a = h(x0, y0);
  const b = h(x0 + 1, y0);
  const c = h(x0, y0 + 1);
  const d = h(x0 + 1, y0 + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Силуэт (чёрный край) + заливки сзади-наперёд. Детали без своей обводки. */
function commit(ctx, masses, details) {
  ctx.fillStyle = C.ink;
  for (const r of masses) {
    if (r[2] <= 0 || r[3] <= 0) continue;
    ctx.fillRect(r[0] - 1, r[1] - 1, r[2] + 2, r[3] + 2);
  }
  for (const r of masses) {
    if (r[2] <= 0 || r[3] <= 0) continue;
    ctx.fillStyle = r[4];
    ctx.fillRect(r[0], r[1], r[2], r[3]);
  }
  if (!details) return;
  for (const r of details) {
    if (r[2] <= 0 || r[3] <= 0) continue;
    ctx.fillStyle = r[4];
    ctx.fillRect(r[0], r[1], r[2], r[3]);
  }
}

function legPair(frame, pants, pantsDk, boot, bootHi) {
  const poses = [
    [[-6, -9, 0], [-1, -9, 0]],
    [[-7, -11, -3], [0, -8, 0]],
    [[-6, -8, 0], [-1, -11, -3]],
    [[-5, -10, -1], [1, -9, -1]],
  ];
  const pose = poses[frame & 3];
  const masses = [];
  const details = [];
  for (const [x, hip, sole] of pose) {
    const pantBot = sole - 3;
    masses.push([x, hip, 4, pantBot - hip, pants]);
    masses.push([x - 1, sole - 3, 6, 3, boot]);
    details.push([x, hip, 1, Math.max(1, pantBot - hip), pantsDk]);
    details.push([x, sole - 1, 4, 1, bootHi]);
  }
  return { masses, details };
}

function eyes(x, y, berserk) {
  const e = berserk ? '#ff5030' : C.eye;
  return [
    [x, y, 2, 2, e],
    [x + 5, y, 2, 2, e],
    [x, y, 1, 1, berserk ? '#ffe080' : C.white],
    [x + 5, y, 1, 1, berserk ? '#ffe080' : C.white],
    [x, y - 2, 2, 1, C.skinDp],
    [x + 5, y - 2, 2, 1, C.skinDp],
  ];
}

function shadow(ctx, x, y, rx, ry) {
  ctx.fillStyle = 'rgba(6,10,16,.38)';
  ctx.beginPath();
  ctx.ellipse(x | 0, y | 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------- карта: тихие поля льда, редкие крупные пропы ---------- */

function drawBarrel(ctx, x, y, w, h, side) {
  px(ctx, x - 1, y - 1, w + 2, h + 2, C.ink);
  px(ctx, x, y, w, h, C.wood);
  px(ctx, x, y, 2, h, C.woodHi);
  px(ctx, x + w - 2, y, 2, h, C.woodDk);
  if (side) {
    px(ctx, x + 3, y, 2, h, C.goldDk);
    px(ctx, x + w - 6, y, 2, h, C.gold);
    px(ctx, x + 4, y, 1, h, C.goldHi);
  } else {
    const step = Math.max(3, (w / 4) | 0);
    for (let i = 3; i < w - 1; i += step) px(ctx, x + i, y + 1, 1, h - 2, C.woodDk);
    px(ctx, x, y + 3, w, 2, C.gold);
    px(ctx, x, y + h - 6, w, 2, C.goldDk);
    px(ctx, x, y + 3, w, 1, C.goldHi);
    px(ctx, x + 2, y + 1, w - 6, 2, C.woodHi);
  }
}

function propBarrels(ctx, x, y) {
  drawBarrel(ctx, x + 1, y + 16, 20, 13, true);
  drawBarrel(ctx, x + 16, y - 2, 14, 26, false);
  px(ctx, x + 18, y - 6, 10, 4, C.foam);
  px(ctx, x + 19, y - 8, 7, 3, C.foamHi);
}

function hopCone(ctx, x, y) {
  commit(ctx, [
    [x + 4, y, 5, 3, C.hopLt],
    [x + 2, y + 2, 9, 3, C.hopHi],
    [x, y + 4, 13, 4, C.hop],
    [x + 1, y + 7, 11, 3, C.hopDk],
    [x + 2, y + 9, 9, 3, C.hop],
    [x + 4, y + 11, 6, 3, C.hopHi],
    [x + 5, y + 14, 3, 6, C.hopDk],
  ], [
    [x + 4, y + 5, 2, 2, C.hopLt],
    [x + 7, y + 8, 2, 2, C.hopLt],
  ]);
}

function propHops(ctx, x, y) {
  px(ctx, x + 2, y + 18, 28, 8, C.hopDk);
  px(ctx, x + 4, y + 16, 10, 6, C.hop);
  px(ctx, x + 16, y + 17, 12, 5, C.hop);
  hopCone(ctx, x + 2, y + 2);
  hopCone(ctx, x + 16, y - 2);
  hopCone(ctx, x + 10, y + 8);
}

function propBanner(ctx, x, y, tattered) {
  px(ctx, x + 5, y - 18, 3, 48, C.ink);
  px(ctx, x + 6, y - 17, 1, 46, C.woodHi);
  px(ctx, x + 3, y - 22, 7, 5, C.gold);
  px(ctx, x + 4, y - 23, 5, 2, C.goldHi);
  const fh = tattered ? 12 : 16;
  px(ctx, x + 8, y - 16, 20, fh, C.ink);
  px(ctx, x + 9, y - 15, 18, fh - 2, C.cape);
  px(ctx, x + 9, y - 15, 18, 3, C.capeHi);
  px(ctx, x + 14, y - 10, 6, 6, C.gold);
  px(ctx, x + 15, y - 12, 4, 3, C.foam);
  px(ctx, x + 19, y - 8, 2, 3, C.goldDk);
  if (tattered) {
    px(ctx, x + 20, y - 6, 6, 5, C.capeDk);
    px(ctx, x + 22, y - 2, 4, 4, C.cape);
  } else {
    px(ctx, x + 22, y - 2, 5, 3, C.capeDk);
  }
}

function propCrack(ctx, x, y) {
  const masses = [
    [x + 6, y + 4, 6, 16, C.iceLip],
    [x + 14, y + 8, 5, 14, '#c5dce8'],
    [x + 20, y + 12, 4, 10, C.iceHi],
    [x + 10, y + 18, 16, 6, '#6a8ea0'],
  ];
  commit(ctx, masses, [
    [x + 8, y + 6, 2, 8, C.white],
    [x + 15, y + 10, 1, 6, C.white],
    [x + 12, y + 20, 10, 2, C.crack],
    [x + 8, y + 14, 2, 6, C.crack],
  ]);
}

function drawSlip(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.5);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(160, 198, 214, 0.07)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(214, 236, 246, 0.32)';
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(236, 248, 255, 0.5)';
  ctx.fillRect((x - r * 0.28) | 0, (y - 1) | 0, Math.max(4, r * 0.28) | 0, 1);
  ctx.fillRect((x + r * 0.08) | 0, (y + 3) | 0, Math.max(3, r * 0.16) | 0, 1);
}

function drawPolynya(ctx, x, y, r) {
  ctx.fillStyle = C.iceLip;
  ctx.beginPath();
  ctx.ellipse(x, y, r + 6, r * 0.7 + 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.iceHi;
  ctx.beginPath();
  ctx.ellipse(x, y - 1, r + 2, r * 0.58 + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.water;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.64, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.waterHi;
  ctx.beginPath();
  ctx.ellipse(x - r * 0.12, y - r * 0.1, r * 0.62, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(220, 230, 214, 0.8)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.22, r * 0.62, Math.max(2, r * 0.12), 0, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, x - r * 0.3, y - r * 0.08, 2, 2, 'rgba(210,235,225,.55)');
  px(ctx, x + r * 0.2, y + r * 0.02, 2, 2, 'rgba(210,235,225,.4)');
  px(ctx, x - 2, y + 2, 3, 1, 'rgba(255,255,255,.35)');
}

function propSnow(ctx, x, y) {
  px(ctx, x + 2, y + 18, 28, 8, '#c8d8e4');
  px(ctx, x + 6, y + 14, 20, 8, '#e4eef4');
  px(ctx, x + 10, y + 12, 12, 5, '#f4fafc');
}

function propStake(ctx, x, y) {
  px(ctx, x + 14, y - 6, 4, 36, C.woodDk);
  px(ctx, x + 15, y - 4, 2, 32, C.woodHi);
  px(ctx, x + 12, y - 8, 8, 4, C.wood);
  px(ctx, x + 8, y + 24, 16, 5, '#9ab0c0');
}

function propCrate(ctx, x, y) {
  px(ctx, x + 4, y + 8, 24, 18, C.wood);
  px(ctx, x + 4, y + 8, 24, 3, C.woodHi);
  px(ctx, x + 4, y + 16, 24, 2, C.woodDk);
  px(ctx, x + 14, y + 8, 3, 18, C.woodDk);
  px(ctx, x + 6, y + 11, 6, 3, C.gold);
}

export function drawWorld(ctx, cam, map, t, hazards = []) {
  ctx.imageSmoothingEnabled = false;
  const tx0 = Math.floor(cam.x / TILE) - 2;
  const ty0 = Math.floor(cam.y / TILE) - 2;
  const tx1 = Math.floor((cam.x + VIEW_W) / TILE) + 2;
  const ty1 = Math.floor((cam.y + VIEW_H) / TILE) + 2;

  ctx.fillStyle = '#3a5a70';
  ctx.fillRect(-4, -4, VIEW_W + 8, VIEW_H + 8);

  const props = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const sx = Math.floor(tx * TILE - cam.x);
      const sy = Math.floor(ty * TILE - cam.y);
      const n1 = vnoise(tx, ty, 11, 1);
      const n2 = vnoise(tx, ty, 6, 11);
      const v = n1 * 0.75 + n2 * 0.25;
      // светлее и контрастнее — не «чёрная дыра»
      if (!blitTile(ctx, 'tile_ice', sx, sy, TILE)) {
        const r = (52 + v * 48) | 0;
        const g = (78 + v * 52) | 0;
        const b = (98 + v * 48) | 0;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
      } else {
        // лёгкий оттенок поверх тайла, чтобы не было идеальной сетки
        ctx.fillStyle = `rgba(20,40,60,${(v * 0.12).toFixed(3)})`;
        ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
      }

      // редкие мягкие сугробы (без чёрных дуг)
      if ((hash(tx * 3, ty * 5) % 11) === 0) {
        px(ctx, sx + 6, sy + 22, 20, 5, 'rgba(220,235,245,.28)');
      }

      // редкие трещины — тонкие и короткие, не «каракули»
      const cn = vnoise(tx, ty, 9, 50);
      if (Math.abs(cn - 0.55) < 0.01) {
        const cx = sx + TILE / 2;
        const cy = sy + TILE / 2;
        ctx.strokeStyle = 'rgba(14,22,30,.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy);
        ctx.lineTo(cx + 8, cy + 2);
        ctx.stroke();
      }

      if ((hash(tx, ty) % 40) === (Math.floor(t * 2) % 40)) {
        px(ctx, sx + 16, sy + 12, 2, 2, 'rgba(255,255,255,.65)');
      }

      // пропы умеренно (~8%), крупные, без клеточки
      const ph = hash(tx + 19, ty + 83);
      if ((ph % 12) === 0 && (hash(tx - 1, ty) % 12) !== 0) {
        props.push([sx, sy, (ph >>> 8) % 6, (ph & 64) !== 0]);
      }
    }
  }

  for (const [sx, sy, kind, tattered] of props) {
    const propKeys = ['prop_barrel', 'prop_snow', 'prop_banner', 'prop_crack', 'prop_crate', 'prop_stake'];
    const key = propKeys[kind] || 'prop_rock';
    if (!blitProp(ctx, key, sx - 8, sy - 8, 48)) {
      if (kind === 0) propBarrels(ctx, sx, sy);
      else if (kind === 1) propSnow(ctx, sx, sy);
      else if (kind === 2) propBanner(ctx, sx, sy, tattered);
      else if (kind === 3) propCrack(ctx, sx, sy);
      else if (kind === 4) propCrate(ctx, sx, sy);
      else propStake(ctx, sx, sy);
    }
  }

  for (const hz of hazards) {
    const hx = hz.x - cam.x;
    const hy = hz.y - cam.y;
    const r = hz.r || 36;
    if (hx < -r - 20 || hy < -r - 20 || hx > VIEW_W + r || hy > VIEW_H + r) continue;
    if (hz.kind === 'slip') drawSlip(ctx, hx, hy, r);
    else if (hz.kind === 'polynya') drawPolynya(ctx, hx, hy, r);
  }

  for (let i = 0; i < 34; i++) {
    const spd = 16 + (i % 5) * 5;
    const sx = ((i * 211 + t * spd - cam.x * 0.35) % (VIEW_W + 20) + (VIEW_W + 20)) % (VIEW_W + 20) - 10;
    const sy = ((i * 137 + t * spd * 1.7 - cam.y * 0.35) % (VIEW_H + 20) + (VIEW_H + 20)) % (VIEW_H + 20) - 10;
    const big = i % 8 === 0;
    px(ctx, sx, sy, big ? 2 : 1, big ? 2 : 1, big ? 'rgba(238,246,252,.55)' : 'rgba(230,240,250,.38)');
  }

  const vig = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 220, VIEW_W / 2, VIEW_H / 2, 700);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(6,12,18,0.22)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

/* ---------- герои ---------- */

function drawKirill(ctx, frame, berserk, t) {
  const swing = [0, -2, 0, 2][frame & 3];
  const coat = berserk ? '#a44a28' : C.coat;
  const coatHi = berserk ? '#e07848' : C.coatHi;
  const coatLt = berserk ? '#ffc090' : C.coatLt;
  const coatDk = berserk ? '#6a2818' : C.coatDk;
  const legs = legPair(frame, C.pants, C.pantsDk, C.boot, C.bootDk);
  const masses = [
    ...legs.masses,
    [-12, -20 + swing, 4, 8, coatDk],
    [-8, -23, 16, 5, coat],
    [-6, -20, 12, 10, coat],
    [-8, -12, 16, 5, coatDk],
    [-8, -24, 16, 4, C.fur],
    [-6, -34, 12, 10, C.skin],
    [-5, -28, 10, 6, C.beard],
    [-7, -42, 14, 8, C.hat],
    [-11, -36, 4, 9, C.hat],
    [7, -36, 4, 9, C.hat],
    [6, -21 - swing, 5, 8, coat],
    [9, -16 - swing, 4, 3, C.skin],
    [11, -27 - swing, 10, 14, C.gold],
    [12, -30 - swing, 8, 4, C.foam],
    [20, -24 - swing, 4, 2, C.goldDk],
    [22, -24 - swing, 2, 9, C.goldDk],
    [20, -17 - swing, 4, 2, C.goldDk],
  ];
  const details = [
    ...legs.details,
    [-6, -18, 3, 8, coatDk],
    [-1, -19, 3, 8, coatHi],
    [-2, -18, 1, 6, coatLt],
    [-6, -12, 12, 2, C.pantsDk],
    [-2, -12, 4, 2, C.gold],
    [-1, -12, 2, 1, C.goldHi],
    [-7, -23, 14, 2, C.furDk],
    [-4, -22, 8, 2, C.fur],
    [-6, -32, 3, 8, C.skinDk],
    [-5, -27, 10, 2, C.beardDk],
    [-4, -24, 8, 2, C.beardDp],
    [-4, -26, 8, 2, C.beard],
    ...eyes(-4, -31, berserk),
    [-1, -28, 2, 2, C.skinDk],
    [-5, -40, 10, 2, C.hatHi],
    [-7, -36, 14, 2, C.red],
    [-7, -34, 14, 1, C.redDk],
    [-10, -34, 3, 5, C.hatHi],
    [8, -34, 2, 5, C.hatHi],
    [11, -26 - swing, 2, 12, C.goldDk],
    [14, -25 - swing, 2, 8, C.goldHi],
    [12, -27 - swing, 8, 1, C.goldDk],
    [13, -30 - swing, 5, 2, C.white],
    [16, -29 - swing, 2, 2, C.foamDk],
    [6, -19 - swing, 2, 6, coatHi],
    [9, -15 - swing, 2, 2, C.skinDk],
  ];
  if (berserk && ((t * 8) | 0) % 2 === 0) {
    details.push([-10, -26, 2, 3, '#ffb050']);
    details.push([8, -27, 2, 3, '#ff6828']);
    details.push([-2, -44, 2, 3, '#ffd080']);
  }
  commit(ctx, masses, details);
}

function drawGopnik(ctx, frame) {
  const swing = [0, -2, 1, 2][frame & 3];
  const legs = legPair(frame, C.suitDk, '#0e1c10', C.cap, C.stripe);
  const masses = [
    ...legs.masses,
    [-11, -19 + swing, 4, 8, C.suitDk],
    [-7, -24, 14, 14, C.suit],
    [-8, -14, 16, 4, C.suitDk],
    [-5, -34, 11, 10, C.skin],
    [-7, -40, 13, 6, C.cap],
    [5, -37, 7, 3, C.cap],
    [6, -20 - swing, 4, 8, C.suit],
    [8, -16 - swing, 12, 11, C.wood],
  ];
  const details = [
    ...legs.details,
    [-5, -22, 2, 10, C.suitDk],
    [2, -22, 1, 10, C.stripe],
    [4, -22, 1, 10, C.stripe],
    [-6, -16, 12, 2, C.goldDk],
    [-2, -16, 3, 2, C.gold],
    [0, -22, 1, 6, C.goldDk],
    [-1, -20, 3, 1, C.gold],
    [-5, -32, 3, 7, C.skinDk],
    ...eyes(-3, -30, false).slice(0, 4),
    [-3, -32, 2, 1, C.skinDp],
    [2, -32, 2, 1, C.skinDp],
    [-2, -26, 4, 1, C.skinDp],
    [1, -25, 1, 1, C.skinDp],
    [-6, -39, 10, 2, C.capHi],
    [6, -36, 5, 1, C.capHi],
    [8, -15 - swing, 2, 9, C.woodHi],
    [16, -15 - swing, 2, 9, C.woodDk],
    [8, -13 - swing, 12, 2, C.gold],
    [8, -8 - swing, 12, 2, C.goldDk],
    [9, -13 - swing, 12, 1, C.goldHi],
    [10, -16 - swing, 3, 2, C.woodHi],
    [-1, -8, 1, 6, C.stripe],
    [3, -8, 1, 6, C.stripe],
  ];
  commit(ctx, masses, details);
}

function drawSemeon(ctx, frame, t) {
  const sway = [0, -1, 0, 1][frame & 3];
  const bootL = frame === 1 ? -2 : 0;
  const bootR = frame === 2 ? -2 : 0;
  const masses = [
    [12, -46, 3, 46, C.woodDk],
    [-9 + sway, -8, 8, 5, C.robeDk],
    [2 + sway, -8, 8, 5, C.robeDk],
    [-4, bootL - 3, 4, 3 - bootL, C.bootDp],
    [2, bootR - 3, 4, 3 - bootR, C.bootDp],
    [-8, -30, 16, 24, C.robe],
    [-10, -10, 20, 8, C.robeDk],
    [-6, -36, 12, 10, C.skin],
    [-5, -30, 10, 8, C.greyBeard],
    [-8, -44, 16, 12, C.robeDk],
    [-3, -50, 6, 8, C.robeDk],
    [8, -22 + sway, 4, 8, C.robe],
  ];
  const bubble = (t * 3) % 1 > 0.5;
  const details = [
    [-8, -26, 4, 16, C.robeDk],
    [-2, -24, 6, 12, C.apron],
    [-1, -22, 4, 8, C.apronDk],
    [-6, -14, 12, 2, C.goldDk],
    [-2, -14, 3, 2, C.gold],
    [12, -46, 1, 44, C.wood],
    [-6, -34, 3, 7, C.skinDk],
    [-4, -28, 8, 3, C.greyDk],
    [-3, -24, 6, 3, C.greyBeard],
    ...eyes(-4, -32, false),
    [-4, -34, 3, 1, C.greyDk],
    [1, -34, 3, 1, C.greyDk],
    [-6, -42, 12, 3, C.robeHi],
    [-2, -49, 4, 3, C.robeHi],
    [-9, -8, 6, 2, C.robe],
    [3, -8, 6, 2, C.robe],
  ];
  commit(ctx, masses, details);
  hopCone(ctx, 6, -64);
  px(ctx, 9, -66, 6, 3, bubble ? C.white : C.foam);
  px(ctx, 10, -68, 4, 2, C.foamHi);
}

export function drawHero(ctx, ch, x, y, facing, moving, t, dashing, berserk, attackT = 0) {
  ctx.imageSmoothingEnabled = false;
  const id = (ch && ch.id) || 'kirill';
  const frame = moving ? (Math.floor(t * 10) & 3) : 0;
  const bob = moving ? ((Math.floor(t * 10) & 1) ? -1 : 0) : Math.sin(t * 3);
  const footY = Math.round(y + 8 + bob);
  const footX = Math.round(x);
  shadow(ctx, footX, footY + 1, 14, 5);

  // выбор кадра: атака > ходьба (для Кирилла) > idle PNG
  let key = id;
  if (id === 'kirill' && attackT > 0) {
    const af = Math.min(3, Math.floor((0.35 - Math.min(0.35, attackT)) / 0.35 * 4));
    key = animKey('kirill_atk', af) || id;
  } else if (id === 'kirill' && moving) {
    key = animKey('kirill_walk', frame) || id;
  }

  const usePng = !!spr(key) || !!spr(id);
  const paint = (ox, alpha) => {
    if (usePng) {
      const ok = blit(ctx, key, footX + ox, footY, {
        facing: facing < 0 ? -1 : 1,
        scale: 1,
        alpha,
      });
      if (!ok) blit(ctx, id, footX + ox, footY, { facing: facing < 0 ? -1 : 1, scale: 1, alpha });
      return;
    }
    ctx.save();
    ctx.translate(footX + ox, footY);
    ctx.scale(facing < 0 ? -2.4 : 2.4, 2.4);
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    if (id === 'gopnik') drawGopnik(ctx, frame);
    else if (id === 'semeon') drawSemeon(ctx, frame, t);
    else drawKirill(ctx, frame, !!berserk, t);
    ctx.restore();
  };

  if (dashing) {
    const dir = facing < 0 ? -1 : 1;
    paint(-dir * 16, 0.22);
    paint(-dir * 8, 0.38);
  }
  paint(0, 1);

  if (berserk) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,120,40,.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(footX, footY - 36, 26, 36, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/* ---------- враги ---------- */

function squire(ctx, frame) {
  const swing = [0, -2, 0, 2][frame & 3];
  const legs = legPair(frame, C.tunicDk, '#2a1014', C.bootDp, '#5a4638');
  const masses = [
    ...legs.masses,
    [-15, -18, 8, 8, C.woodDk],
    [-14, -17, 6, 6, C.tunic],
    [7, -24 + swing, 2, 18, C.ironHi],
    [5, -8 + swing, 6, 3, C.gold],
    [6, -5 + swing, 2, 4, C.woodDk],
    [-7, -20, 14, 14, C.tunic],
    [-8, -10, 16, 4, C.tunicDk],
    [-5, -30, 10, 10, C.skin],
    [-9, -27, 18, 3, C.ironDk],
    [-4, -36, 8, 10, C.iron],
  ];
  const details = [
    ...legs.details,
    [-5, -18, 3, 8, C.tunicDk],
    [1, -18, 3, 6, C.tunicHi],
    [-6, -12, 12, 2, C.goldDk],
    [-2, -12, 3, 2, C.gold],
    [-13, -16, 4, 1, C.ironHi],
    [-12, -14, 2, 2, C.gold],
    [-5, -28, 2, 6, C.skinDk],
    ...eyes(-3, -25, false),
    [-1, -22, 2, 2, C.skinDk],
    [-2, -20, 3, 1, C.skinDp],
    [-3, -35, 6, 2, C.ironHi],
    [-8, -26, 16, 1, C.ironMd],
    [7, -24 + swing, 1, 16, C.white],
    [4, -8 + swing, 8, 1, C.goldHi],
  ];
  commit(ctx, masses, details);
}

function knight(ctx, frame, lunging) {
  const lean = lunging ? 2 : 0;
  const legs = legPair(frame, C.ironDk, C.ink, C.iron, C.ironHi);
  const spear = lunging
    ? [
      [8, -16, 28, 3, C.wood],
      [34, -20, 8, 8, C.ironHi],
      [36, -18, 8, 3, C.gold],
    ]
    : [
      [8, -40, 3, 32, C.woodDk],
      [6, -44, 7, 6, C.ironHi],
      [7, -46, 5, 3, C.gold],
    ];
  const masses = [
    [-3, -16, 16, 18, C.capeDk],
    ...legs.masses,
    [-16, -20, 9, 4, C.wood],
    [-15, -16, 8, 5, C.ironDk],
    [-14, -11, 6, 4, C.iron],
    [-13, -7, 4, 4, C.woodDk],
    [-8, -22, 16, 14, C.iron],
    [-10, -26, 20, 6, C.ironDk],
    [-6, -40, 12, 16, C.ironDk],
    [8, -20 + lean, 5, 7, C.iron],
    ...spear,
  ];
  const details = [
    ...legs.details,
    [2, -12, 8, 12, C.cape],
    [6, -6, 6, 6, C.capeHi],
    [-6, -20, 4, 8, C.ironDk],
    [2, -20, 4, 6, C.ironMd],
    [-4, -18, 8, 2, C.gold],
    [-3, -17, 6, 1, C.goldHi],
    [-14, -18, 5, 1, C.ironHi],
    [-13, -15, 3, 3, C.gold],
    [-12, -12, 2, 2, C.cape],
    [-5, -38, 10, 3, C.ironMd],
    [-4, -32, 8, 2, C.ink],
    [-1, -36, 2, 8, C.ink],
    [-3, -31, 2, 2, '#ffd060'],
    [1, -31, 2, 2, '#ffd060'],
    [-7, -41, 14, 2, C.gold],
    [-8, -26, 4, 2, C.ironHi],
    [6, -26, 4, 2, C.ironHi],
  ];
  if (lunging) {
    details.push([34, -18, 6, 1, C.white]);
  } else {
    details.push([8, -40, 1, 30, C.wood]);
  }
  commit(ctx, masses, details);
}

function thrower(ctx, frame, windup) {
  const armY = windup ? -28 : -16;
  const legs = legPair(frame, '#243038', '#14181c', C.bootDp, '#4a4038');
  for (const r of legs.masses) {
    if (r[2] === 4) r[2] = 3;
  }
  const masses = [
    ...legs.masses,
    [-8, -14, 4, 6, C.glass],
    [-7, -18, 3, 5, C.bottle],
    [-4, -12, 3, 5, C.glass],
    [5, -22, 4, 7, C.bottle],
    [6, -26, 3, 5, C.glass],
    [-4, -22, 8, 14, '#7a5a40'],
    [-5, -12, 10, 3, '#4a3424'],
    [-3, -32, 7, 10, C.skin],
    [-5, -38, 10, 8, '#2c241c'],
    [-2, -42, 5, 5, '#2c241c'],
    [4, armY, 3, 10, '#6a4c38'],
    [6, armY - 2, 5, 12, C.bottle],
  ];
  const details = [
    ...legs.details,
    [-3, -20, 2, 8, '#4a3424'],
    [1, -20, 2, 6, '#c49a68'],
    [-3, -30, 2, 6, C.skinDk],
    ...eyes(-2, -28, false),
    [-1, -25, 2, 1, C.skinDp],
    [-4, -36, 8, 2, '#5a4636'],
    [6, armY - 4, 3, 3, C.glass],
    [7, armY, 2, 6, C.bottleHi],
    [7, armY + 6, 3, 3, C.goldDk],
    [6, -24, 1, 4, C.bottleHi],
    [-6, -16, 1, 4, C.glass],
  ];
  commit(ctx, masses, details);
}

function foamBlob(ctx, t) {
  const w = Math.round(Math.sin(t * 7));
  const masses = [
    [-12 + w, -5, 24, 11, C.foamSh],
    [-10, -12, 20, 10, C.foam],
    [-7, -17, 12, 7, C.white],
    [8, -14, 8, 8, C.foam],
    [-16, -4, 7, 7, C.foamDk],
    [12, -6, 6, 6, C.foamDk],
    [-3, -21, 8, 6, C.white],
    [5, -19, 5, 5, C.foamHi],
  ];
  const details = [
    [-8, -10, 5, 3, C.white],
    [1, -8, 4, 3, C.foamSh],
    [-6, -7, 3, 3, C.eye],
    [2, -7, 3, 3, C.eye],
    [-5, -6, 1, 1, C.white],
    [3, -6, 1, 1, C.white],
    [-3, -3, 6, 2, '#b8a888'],
    [-1, -2, 2, 2, '#8a7858'],
    [9, -12, 3, 2, C.white],
    [-1, -19, 3, 2, C.white],
    [-14, -2, 3, 2, C.foam],
  ];
  commit(ctx, masses, details);
}

function bannerBearer(ctx, frame, t) {
  const wave = Math.sin(t * 4) * 2;
  const legs = legPair(frame, C.tunicDk, '#2a1014', C.bootDp, '#5a4030');
  const masses = [
    ...legs.masses,
    [0, -46, 3, 46, C.woodDk],
    [3, -44, 16 + wave, 14, C.cape],
    [-6, -20, 12, 14, '#c4a050'],
    [-7, -10, 14, 4, C.goldDk],
    [-4, -30, 9, 10, C.skin],
    [-6, -34, 12, 6, C.hat],
    [4, -18, 3, 8, C.goldDk],
  ];
  const details = [
    ...legs.details,
    [1, -46, 1, 44, C.wood],
    [4, -43, 14, 3, C.capeHi],
    [7, -38, 6, 6, C.gold],
    [8, -40, 4, 3, C.foam],
    [12, -36, 2, 3, C.goldDk],
    [3 + wave, -34, 3, 4, C.capeDk],
    [-4, -18, 3, 8, '#a08030'],
    [1, -18, 3, 6, '#e6c878'],
    [-5, -12, 10, 2, C.red],
    [-4, -28, 2, 6, C.skinDk],
    ...eyes(-2, -26, false),
    [-5, -33, 10, 2, C.hatHi],
    [-1, -23, 2, 1, C.skinDp],
  ];
  commit(ctx, masses, details);
}

function baron(ctx, frame, t, lunging) {
  const sway = [0, 1, 0, -1][frame & 3];
  const lean = lunging ? 3 : 0;
  const masses = [
    [-20, -16, 40, 20, C.capeDk],
    [-16, -28, 32, 16, C.cape],
    [-8, -10, 6, 8, C.ironDk],
    [3, -10, 6, 8, C.ironDk],
    [-7, -4, 6, 4, C.iron],
    [2, -4, 6, 4, C.iron],
    [-12, -26, 24, 16, C.ironDk],
    [-10, -24, 20, 12, C.iron],
    [-14, -30, 8, 6, C.goldDk],
    [6, -30, 8, 6, C.goldDk],
    [-8, -46, 16, 18, C.ironDk],
    [-16, -40, 6, 8, C.gold],
    [10, -40, 6, 8, C.gold],
    [-18, -44, 4, 6, C.goldDk],
    [14, -44, 4, 6, C.goldDk],
    [12 + lean, -52, 3, 40, C.woodDk],
    [8 + lean, -60, 12, 12, C.gold],
    [9 + lean, -64, 10, 5, C.foam],
    [-6, -30, 12, 6, C.beard],
  ];
  const gleam = (Math.floor(t * 3) & 1) ? C.goldHi : C.gold;
  const details = [
    [-18, -14, 8, 10, C.capeHi],
    [10, -12, 8, 8, C.capeDk],
    [-8, -22, 6, 8, C.ironDk],
    [2, -20, 6, 6, C.ironMd],
    [-6, -20, 12, 3, C.gold],
    [-4, -19, 8, 1, gleam],
    [0, -16, 3, 5, '#7a1828'],
    [-6, -44, 12, 4, C.ironMd],
    [-5, -38, 10, 3, C.ink],
    [-1, -44, 2, 10, C.ink],
    [-4, -37, 2, 2, '#ffd868'],
    [2, -37, 2, 2, '#ffd868'],
    [-9, -47, 18, 2, C.gold],
    [-14, -42, 3, 4, C.goldHi],
    [12, -40, 3, 3, C.goldHi],
    [-4, -28, 8, 3, C.beardDk],
    [12 + lean, -52, 1, 36, C.wood],
    [8 + lean, -58, 3, 8, C.goldDk],
    [14 + lean, -56, 2, 6, C.goldHi],
    [10 + lean, -63, 6, 2, C.white],
    [16 + lean, -58, 3, 5, C.goldDk],
    [-12, -8, 4, 2, C.ironHi],
    [4, -8, 4, 2, C.ironHi],
    [-20 + sway, -6, 6, 4, C.cape],
    [14 - sway, -4, 6, 4, C.capeDk],
  ];
  commit(ctx, masses, details);
}

function hpBar(ctx, x, y, w, frac) {
  const f = Math.max(0, Math.min(1, frac));
  px(ctx, x - 1, y - 1, w + 2, 5, '#0c0e12');
  px(ctx, x, y, w, 3, '#3a1418');
  const fw = (w * f) | 0;
  px(ctx, x, y, fw, 3, f > 0.35 ? '#d04848' : '#e8c040');
  if (fw > 0) px(ctx, x, y, fw, 1, 'rgba(255,255,255,.4)');
}

export function drawEnemy(ctx, e, cam, t) {
  ctx.imageSmoothingEnabled = false;
  const x = Math.round(e.x - cam.x);
  const bob = (Math.floor(t * 6 + (e.x || 0)) & 1) ? 0 : -1;
  const y = Math.round(e.y - cam.y + bob);
  const id = e.id || '';
  const lunging = !!(e.charge && e.chargeT > 1.25 && e.chargeDir);
  let face = x < VIEW_W / 2 ? 1 : -1;
  if (e.chargeDir && e.chargeDir.x) face = e.chargeDir.x >= 0 ? 1 : -1;

  let kind = 'squire';
  if (e.boss || id === 'khmeldorf') kind = 'boss';
  else if (e.buff || id === 'znamenosets') kind = 'banner';
  else if (e.explode || id === 'penodukh') kind = 'blob';
  else if (e.shoot || id === 'metalshchik') kind = 'thrower';
  else if (e.charge || id === 'rytsar') kind = 'knight';

  const pngKey = id || ({
    boss: 'khmeldorf', banner: 'znamenosets', blob: 'penodukh',
    thrower: 'metalshchik', knight: 'rytsar', squire: 'oruzhenosets',
  })[kind];

  shadow(ctx, x, y + 8, kind === 'boss' ? 22 : 12, kind === 'boss' ? 6 : 4);

  const walkFrame = Math.floor(t * 8 + (e.x || 0) * 0.05) & 3;
  const useWalk = !e.boss && (kind === 'squire' || kind === 'knight') && animKey('enemy_walk', walkFrame);
  const drawKey = useWalk || (spr(pngKey) ? pngKey : null);
  if (drawKey) {
    blit(ctx, drawKey, x + (lunging ? face * 4 : 0), y + 10, {
      facing: face,
      scale: kind === 'boss' ? 1.15 : (useWalk ? 1.05 : 1),
      alpha: e.hitFlash > 0 ? 0.7 : 1,
    });
    if (e.hp < e.maxHp) {
      const bw = kind === 'boss' ? 48 : 26;
      px(ctx, x - bw / 2, y - (kind === 'boss' ? 100 : 78), bw, 3, '#201008');
      px(ctx, x - bw / 2, y - (kind === 'boss' ? 100 : 78), bw * Math.max(0, e.hp / e.maxHp), 3, '#e05050');
    }
    return;
  }

  const scale = kind === 'boss' ? 2.15 : kind === 'blob' ? 2.05 : kind === 'knight' ? 2 : 1.85;
  const frame = Math.floor(t * 8 + (e.y || 0) * 0.05) & 3;
  const windup = kind === 'thrower' && e.shootCd != null && e.shootCd < 0.4;

  ctx.save();
  ctx.translate(x + (lunging ? face * 4 : 0), y + 8);
  ctx.scale(face * scale, scale);
  ctx.imageSmoothingEnabled = false;
  if (kind === 'boss') baron(ctx, frame, t, lunging);
  else if (kind === 'banner') bannerBearer(ctx, frame, t);
  else if (kind === 'blob') foamBlob(ctx, t + (e.x || 0) * 0.01);
  else if (kind === 'thrower') thrower(ctx, frame, windup);
  else if (kind === 'knight') knight(ctx, lunging ? 1 : frame, lunging);
  else squire(ctx, frame);

  if (e.hitFlash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    const hw = kind === 'boss' ? 22 : 16;
    const hh = kind === 'boss' ? 64 : 44;
    ctx.fillRect(-hw, -hh, hw * 2, hh);
  }
  ctx.restore();

  if (e.slowT > 0) {
    px(ctx, x - 8, y + 4, 4, 3, 'rgba(255,248,230,.75)');
    px(ctx, x + 5, y + 6, 3, 2, 'rgba(255,248,230,.55)');
    px(ctx, x - 1, y + 2, 2, 2, C.white);
  }
  if (kind === 'banner') {
    ctx.strokeStyle = `rgba(230,190,70,${0.35 + Math.sin(t * 5) * 0.15})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 18, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (lunging && kind === 'knight') {
    for (let i = 0; i < 3; i++) {
      px(ctx, x - face * (12 + i * 7), y + 4 + (i & 1) * 2, 4, 2, 'rgba(210,228,236,.5)');
    }
  }

  if (e.hp < e.maxHp) {
    const w = kind === 'boss' ? 52 : 26;
    const top = kind === 'boss' ? 78 : kind === 'banner' ? 62 : kind === 'knight' ? 56 : 50;
    hpBar(ctx, x - (w / 2 | 0), y - top, w, e.hp / e.maxHp);
  }
}

/* ---------- снаряды, лут, эффекты, иконки ---------- */

function projMug(ctx) {
  commit(ctx, [
    [-5, -7, 9, 12, C.gold],
    [-4, -10, 7, 4, C.foam],
    [4, -4, 3, 2, C.goldDk],
    [5, -4, 2, 6, C.goldDk],
    [4, 0, 3, 2, C.goldDk],
  ], [
    [-5, -6, 2, 10, C.goldDk],
    [-1, -5, 2, 7, C.goldHi],
    [-3, -7, 6, 1, C.goldDk],
    [-2, -10, 4, 2, C.white],
  ]);
}

function projBarrel(ctx) {
  drawBarrel(ctx, -8, -6, 16, 12, false);
}

function projFoam(ctx) {
  commit(ctx, [
    [-7, -5, 14, 10, C.foamDk],
    [-5, -8, 10, 6, C.foam],
    [3, -7, 6, 5, C.white],
    [-8, -1, 5, 4, C.foam],
  ], [
    [-3, -6, 3, 2, C.white],
    [0, -2, 2, 2, C.foamSh],
  ]);
}

function projBottle(ctx, color) {
  const glass = color || C.bottle;
  commit(ctx, [
    [-3, -9, 6, 14, glass],
    [-2, -12, 4, 4, C.glass],
    [-2, -14, 4, 2, C.foamDk],
  ], [
    [-2, -8, 1, 10, 'rgba(255,255,255,.55)'],
    [-2, 0, 4, 4, C.goldDk],
    [-1, -12, 2, 2, C.white],
  ]);
}

function projHop(ctx) {
  hopCone(ctx, -6, -10, 1);
}

function projSickle(ctx, color) {
  const col = color || C.hopHi;
  px(ctx, -8, -1, 10, 3, C.woodDk);
  px(ctx, -2, -6, 3, 8, C.ink);
  px(ctx, -1, -6, 8, 3, col);
  px(ctx, 5, -8, 3, 5, col);
  px(ctx, 6, -8, 3, 2, C.white);
  px(ctx, 0, -5, 6, 1, C.hopLt);
}

export function drawProj(ctx, p, cam) {
  if (!p || p.kind === 'arc') return;
  const x = p.x - cam.x;
  const y = p.y - cam.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.imageSmoothingEnabled = false;
  const shape = p.shape || p.vis || (p.slow ? 'foam' : p.kind === 'enemy' ? 'bottle' : 'bolt');
  if (p.vx || p.vy) ctx.rotate(Math.atan2(p.vy || 0, p.vx || 1));
  if (shape === 'barrel' || shape === 'mug' || shape === 'hop') {
    ctx.rotate(((p.x + p.y) * 0.05) % 6.28);
  }
  if (shape === 'barrel') projBarrel(ctx);
  else if (shape === 'foam') projFoam(ctx);
  else if (shape === 'bottle' || p.kind === 'enemy') projBottle(ctx, p.color);
  else if (shape === 'mug') projMug(ctx);
  else if (shape === 'hop') projHop(ctx);
  else if (shape === 'serp' || shape === 'sickle') projSickle(ctx, p.color);
  else projSickle(ctx, p.color || C.goldHi);
  ctx.restore();
}

function diamond(ctx, x, y, r, fill, hi, dk) {
  for (let row = -r; row <= r; row++) {
    const half = r - Math.abs(row);
    const yy = (y + row) | 0;
    px(ctx, x - half, yy, half, 1, dk);
    px(ctx, x, yy, half + 1, 1, fill);
  }
  px(ctx, x - 1, y - r + 1, 2, 2, hi);
  px(ctx, x, y - r, 1, 1, C.white);
}

export function drawGem(ctx, g, cam) {
  ctx.imageSmoothingEnabled = false;
  const x = g.x - cam.x;
  const y = g.y - cam.y;
  shadow(ctx, x, y + (g.big ? 7 : 5), g.big ? 6 : 4, 2);
  if (g.big) diamond(ctx, x, y, 5, '#e07040', '#ffd0a0', '#a03820');
  else diamond(ctx, x, y, 3, '#3aa8d8', '#d8f4ff', '#1a5880');
}

export function drawPickup(ctx, it, cam, t) {
  ctx.imageSmoothingEnabled = false;
  const x = Math.round(it.x - cam.x);
  const y = Math.round(it.y - cam.y + Math.sin(t * 3 + (it.x || 0)) * 2);
  shadow(ctx, x, y + 8, 8, 3);
  ctx.save();
  ctx.translate(x, y);
  if (it.kind === 'coin') {
    commit(ctx, [
      [-5, -5, 10, 10, C.goldDk],
      [-4, -6, 8, 10, C.gold],
    ], [
      [-3, -4, 6, 6, C.goldHi],
      [-1, -3, 2, 5, C.goldDk],
      [-2, -5, 2, 2, C.white],
    ]);
  } else if (it.kind === 'potion') {
    commit(ctx, [
      [-4, -6, 8, 12, '#d07038'],
      [-2, -10, 4, 5, C.glass],
      [-2, -12, 4, 3, C.foamDk],
    ], [
      [-3, -4, 2, 8, '#f0a060'],
      [-3, 0, 6, 5, '#a85020'],
      [-1, -11, 2, 2, C.white],
      [-3, -5, 1, 6, 'rgba(255,255,255,.6)'],
    ]);
  } else if (it.kind === 'chest' || it.kind === 'gear_chest') {
    commit(ctx, [
      [-11, -2, 22, 12, C.wood],
      [-12, -8, 24, 8, C.woodHi],
      [-12, -9, 24, 3, C.woodDk],
    ], [
      [-11, -1, 22, 2, C.goldDk],
      [-3, -4, 6, 6, C.gold],
      [-2, -3, 4, 2, C.goldHi],
      [-1, -1, 2, 3, C.goldDk],
      [-8, -7, 4, 2, C.fur],
      [6, -7, 3, 2, C.white],
    ]);
    if (it.kind === 'gear_chest') {
      px(ctx, -2, -16, 4, 4, '#ffe080');
    }
  }
  ctx.restore();
}

function sparkRing(ctx, x, y, r, n, col, size) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    px(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, size, size, col);
  }
}

export function drawFx(ctx, f, cam) {
  const x = f.x - cam.x;
  const y = f.y - cam.y;
  ctx.imageSmoothingEnabled = false;
  if (f.kind === 'dmg') {
    const life = Math.max(0, f.life || 0);
    const a = Math.min(1, life * 2.4);
    const pop = 1 + Math.min(0.45, life * 0.7);
    const size = Math.round((f.crit ? 15 : 11) * pop);
    ctx.save();
    ctx.font = `800 ${size}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(8,8,12,${a})`;
    ctx.fillStyle = f.crit ? `rgba(255,208,64,${a})` : `rgba(255,244,230,${a})`;
    ctx.strokeText(f.text, x, y);
    ctx.fillText(f.text, x, y);
    if (f.crit) {
      px(ctx, x + size * 0.6, y - size, 2, 2, `rgba(255,240,180,${a})`);
      px(ctx, x - size * 0.7, y - size * 0.6, 2, 2, `rgba(255,240,180,${a})`);
    }
    ctx.restore();
  } else if (f.kind === 'arc') {
    const a = Math.min(1, (f.life || 0) * 5);
    ctx.save();
    ctx.strokeStyle = `rgba(90,50,16,${a})`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, y, f.r, f.a0, f.a1);
    ctx.stroke();
    ctx.strokeStyle = `rgba(232,184,72,${a})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, f.r, f.a0, f.a1);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,248,220,${a * 0.9})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, f.r - 3), f.a0 + 0.04, f.a1 - 0.04);
    ctx.stroke();
    const mid = (f.a0 + f.a1) / 2;
    for (let i = 0; i < 5; i++) {
      const ang = f.a0 + (f.a1 - f.a0) * (i / 4);
      px(ctx, x + Math.cos(ang) * (f.r + 3), y + Math.sin(ang) * (f.r + 3), 2, 2, `rgba(255,236,200,${a})`);
    }
    px(ctx, x + Math.cos(mid) * f.r - 3, y + Math.sin(mid) * f.r - 4, 4, 3, `rgba(255,250,240,${a})`);
    ctx.restore();
  } else if (f.kind === 'ring') {
    const a = Math.min(1, (f.life || 0) * 2.2);
    ctx.save();
    ctx.strokeStyle = `rgba(80,48,16,${a})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, f.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(236,206,120,${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, f.r - 2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,248,230,${a * 0.8})`;
    ctx.beginPath();
    ctx.arc(x, y, f.r + 3, 0, Math.PI * 2);
    ctx.stroke();
    sparkRing(ctx, x, y, f.r, 8, `rgba(255,250,240,${a})`, 2);
    ctx.restore();
  } else if (f.kind === 'text') {
    const a = Math.min(1, (f.life || 0) * 1.4);
    ctx.save();
    ctx.font = '800 14px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(10,12,16,${a})`;
    ctx.fillStyle = `rgba(255,226,160,${a})`;
    ctx.strokeText(f.text, x, y);
    ctx.fillText(f.text, x, y);
    ctx.restore();
  } else if (f.kind === 'berserk') {
    const a = Math.min(1, (f.life || 0) * 2);
    ctx.save();
    ctx.fillStyle = `rgba(255,110,30,${a * 0.16})`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(4, f.r * 0.55), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,150,40,${a})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, f.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,220,140,${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, f.r - 5), 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + 0.2;
      const r0 = f.r - 2;
      const r1 = f.r + 7;
      ctx.strokeStyle = `rgba(255,180,60,${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0);
      ctx.lineTo(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1);
      ctx.stroke();
    }
    ctx.restore();
  }
}

const ICONS = {
  kruzhka: (ctx) => projMug(ctx),
  nakat: (ctx) => {
    projMug(ctx);
    px(ctx, -8, 4, 16, 2, C.foam);
    px(ctx, -6, 6, 10, 2, C.foamDk);
  },
  bochonok: (ctx) => drawBarrel(ctx, -7, -5, 14, 10, false),
  taran: (ctx) => {
    drawBarrel(ctx, -8, -5, 16, 11, false);
    px(ctx, -4, -8, 8, 3, C.foam);
  },
  pena: (ctx) => projFoam(ctx),
  drakon: (ctx) => {
    projFoam(ctx);
    px(ctx, 6, -8, 5, 3, C.hopHi);
    px(ctx, 9, -10, 3, 3, C.white);
    px(ctx, -9, -2, 4, 3, C.foam);
  },
  serp: (ctx) => projSickle(ctx, C.hopHi),
  bich: (ctx) => {
    px(ctx, -7, 0, 5, 2, C.hopDk);
    px(ctx, -3, -3, 4, 3, C.hop);
    px(ctx, 0, -6, 3, 4, C.gold);
    px(ctx, 2, -9, 3, 4, C.goldHi);
    px(ctx, 4, -12, 2, 4, C.white);
    px(ctx, -1, -4, 2, 2, C.hopLt);
  },
  zhiguli: (ctx) => projBottle(ctx, C.bottle),
  orbit_hmel: (ctx) => hopCone(ctx, -6, -9, 1),
};

export function drawIcon(ctx, id, x, y, scale = 2) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;
  const fn = ICONS[id];
  if (fn) fn(ctx);
  else projBottle(ctx, C.glass);
  ctx.restore();
}
