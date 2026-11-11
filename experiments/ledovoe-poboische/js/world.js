/** Ледовое поле: тихий лёд, редкие крупные пропы, круговые солиды. */
import { VIEW, SOLID_PROPS } from './data.js';
import { blitProp, blitTile } from './sprites.js';

const TILE = 32;
const CELL = 260;
const FIELD = { x: 5040, y: 3960 };
const CLEAR = 200;
const PLACE_P = 0.88;
const PLAYER_R = 14;
const GRID = 192;

const DECOR_STEP = 280;

const grids = new WeakMap();

function hash(x, y) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

function pickKind(rng) {
  const roll = rng();
  if (roll < 0.34) return 'barrel';
  if (roll < 0.64) return 'crate';
  if (roll < 0.8) return 'rock';
  return 'stake';
}

function tooClose(solids, x, y, gap) {
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    const dx = s.x - x;
    const dy = s.y - y;
    if (dx * dx + dy * dy < gap * gap) return true;
  }
  return false;
}

/**
 * Редкие бочки, ящики, камни и колья на поле вокруг старта.
 * rng — функция () => [0,1). Баннеры и снег не возвращаются.
 */
export function seedWorldSolids(rng = Math.random) {
  const random = typeof rng === 'function' ? rng : Math.random;
  const solids = [];
  for (let cy = -FIELD.y + CELL / 2; cy <= FIELD.y; cy += CELL) {
    for (let cx = -FIELD.x + CELL / 2; cx <= FIELD.x; cx += CELL) {
      if (random() > PLACE_P) continue;
      const cluster = random() < 0.28 ? 2 + ((random() * 2) | 0) : 1;
      for (let n = 0; n < cluster; n++) {
        let placed = false;
        for (let attempt = 0; attempt < 3 && !placed; attempt++) {
          const x = cx + (random() - 0.5) * CELL * 0.86 + (n ? (random() - 0.5) * 70 : 0);
          const y = cy + (random() - 0.5) * CELL * 0.86 + (n ? (random() - 0.5) * 70 : 0);
          if (x * x + y * y < CLEAR * CLEAR) continue;
          const kind = pickKind(random);
          const spec = SOLID_PROPS[kind];
          const gap = spec.r + 40;
          if (tooClose(solids, x, y, gap)) continue;
          solids.push({ x, y, r: spec.r, kind, block: true });
          placed = true;
        }
      }
    }
  }
  return solids;
}

function indexSolids(solids) {
  const cached = grids.get(solids);
  if (cached && cached.n === solids.length) return cached.grid;
  const grid = new Map();
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (!s || s.block === false) continue;
    const key = `${Math.floor(s.x / GRID)},${Math.floor(s.y / GRID)}`;
    let bucket = grid.get(key);
    if (!bucket) grid.set(key, bucket = []);
    bucket.push(s);
  }
  grids.set(solids, { n: solids.length, grid });
  return grid;
}

function separate(ent, s, er) {
  let dx = ent.x - s.x;
  let dy = ent.y - s.y;
  const min = er + (s.r || 0);
  if (min <= 0) return;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return;
  let d = Math.sqrt(d2);
  if (d < 1e-4) {
    dx = 1;
    dy = 0;
    d = 1;
  }
  const nx = dx / d;
  const ny = dy / d;
  const push = min - d;
  ent.x += nx * push;
  ent.y += ny * push;
  if (typeof ent.vx === 'number' && typeof ent.vy === 'number') {
    const vn = ent.vx * nx + ent.vy * ny;
    if (vn < 0) {
      ent.vx -= vn * nx;
      ent.vy -= vn * ny;
    }
  }
}

/**
 * Выталкивает ent из солидов (круг против круга).
 * Радиус сущности — ent.r, иначе 14 (тело игрока). Два прохода на стыки.
 */
export function resolveSolidCollision(ent, solids) {
  if (!ent || !solids || !solids.length) return;
  const er = ent.r > 0 ? ent.r : PLAYER_R;
  const grid = indexSolids(solids);
  for (let pass = 0; pass < 2; pass++) {
    const cx = Math.floor(ent.x / GRID);
    const cy = Math.floor(ent.y / GRID);
    for (let iy = cy - 1; iy <= cy + 1; iy++) {
      for (let ix = cx - 1; ix <= cx + 1; ix++) {
        const bucket = grid.get(`${ix},${iy}`);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) separate(ent, bucket[i], er);
      }
    }
  }
}

function px(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

function shadow(ctx, sx, sy, rw, rh) {
  ctx.save();
  ctx.fillStyle = 'rgba(12, 22, 32, 0.22)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 4, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function fallbackBarrel(ctx, x, y, size) {
  const w = size * 0.42;
  const h = size * 0.56;
  const left = x + (size - w) / 2;
  const top = y + size * 0.28;
  px(ctx, left, top + 4, w, h - 4, '#6a3c1c');
  px(ctx, left, top, w, h * 0.22, '#c48a4c');
  px(ctx, left, top + h * 0.42, w, 3, '#e8b43c');
  px(ctx, left + 2, top + 2, 3, h * 0.7, '#e0b070');
}

function fallbackCrate(ctx, x, y, size) {
  const w = size * 0.62;
  const h = size * 0.46;
  const left = x + (size - w) / 2;
  const top = y + size * 0.4;
  px(ctx, left, top, w, h, '#7a4c28');
  px(ctx, left, top, w, 4, '#c48a4c');
  px(ctx, left + w * 0.46, top, 3, h, '#4a2c16');
  px(ctx, left + 4, top + 6, w * 0.22, 3, '#e8b43c');
}

function fallbackRock(ctx, x, y, size) {
  ctx.save();
  ctx.fillStyle = '#5c6a74';
  ctx.beginPath();
  ctx.ellipse(x + size * 0.5, y + size * 0.62, size * 0.36, size * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8ea0aa';
  ctx.beginPath();
  ctx.ellipse(x + size * 0.46, y + size * 0.52, size * 0.22, size * 0.14, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function fallbackStake(ctx, x, y, size) {
  const left = x + size * 0.46;
  const top = y + size * 0.08;
  px(ctx, left, top, 4, size * 0.78, '#4a2c16');
  px(ctx, left + 1, top + 2, 2, size * 0.7, '#c48a4c');
  px(ctx, left - 3, top, 10, 4, '#7a4c28');
}

function fallbackBanner(ctx, x, y, size) {
  const pole = x + size * 0.28;
  px(ctx, pole, y + size * 0.08, 3, size * 0.84, '#1a140e');
  px(ctx, pole + 3, y + size * 0.12, size * 0.46, size * 0.32, '#721830');
  px(ctx, pole + 3, y + size * 0.12, size * 0.46, 3, '#e8b43c');
}

function fallbackSnow(ctx, x, y, size) {
  ctx.save();
  ctx.fillStyle = 'rgba(232, 242, 248, 0.92)';
  ctx.beginPath();
  ctx.ellipse(x + size * 0.5, y + size * 0.62, size * 0.34, size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f7fbfe';
  ctx.beginPath();
  ctx.ellipse(x + size * 0.46, y + size * 0.52, size * 0.2, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const FALLBACK = {
  barrel: fallbackBarrel,
  crate: fallbackCrate,
  rock: fallbackRock,
  stake: fallbackStake,
};

function drawKeyed(ctx, key, x, y, size, kind) {
  if (blitProp(ctx, key, x, y, size)) return;
  const fb = FALLBACK[kind];
  if (fb) fb(ctx, x, y, size);
  else if (kind === 'banner') fallbackBanner(ctx, x, y, size);
  else if (kind === 'snow') fallbackSnow(ctx, x, y, size);
}

function drawSolidProp(ctx, s, sx, sy) {
  const spec = SOLID_PROPS[s.kind] || { size: 56, r: 16 };
  const size = spec.size;
  shadow(ctx, sx, sy, size * 0.34, size * 0.12);
  const left = Math.round(sx - size / 2);
  const top = Math.round(sy - size * (s.kind === 'stake' ? 0.86 : 0.7));
  drawKeyed(ctx, `prop_${s.kind}`, left, top, size, s.kind);
}

function drawBanner(ctx, p, sx, sy) {
  const size = 64;
  shadow(ctx, sx, sy, 16, 5);
  const left = Math.round(sx - size * 0.34);
  const top = Math.round(sy - size * 0.9);
  drawKeyed(ctx, 'prop_banner', left, top, size, 'banner');
}

function drawSnow(ctx, sx, sy) {
  const size = 64;
  shadow(ctx, sx, sy, size * 0.28, 6);
  const left = Math.round(sx - size / 2);
  const top = Math.round(sy - size * 0.55);
  drawKeyed(ctx, 'prop_snow', left, top, size, 'snow');
}

function drawSlip(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.5);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(186, 214, 226, 0.08)';
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = 'rgba(226, 240, 248, 0.28)';
  ctx.stroke();
  ctx.restore();
}

function drawPolynya(ctx, x, y, r) {
  ctx.fillStyle = '#9ec0d0';
  ctx.beginPath();
  ctx.ellipse(x, y, r + 6, r * 0.7 + 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0e1c26';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(40, 78, 92, 0.85)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.1, y - r * 0.08, r * 0.5, r * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawIce(ctx, cam, map) {
  const tx0 = Math.floor(cam.x / TILE) - 1;
  const ty0 = Math.floor(cam.y / TILE) - 1;
  const tx1 = Math.floor((cam.x + VIEW.w) / TILE) + 1;
  const ty1 = Math.floor((cam.y + VIEW.h) / TILE) + 1;

  const led = !map || map.id === 'ledovoe' || !map.tint;
  ctx.fillStyle = led ? '#6e8ea0' : map.tint;
  ctx.fillRect(-4, -4, VIEW.w + 8, VIEW.h + 8);

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const sx = Math.floor(tx * TILE - cam.x);
      const sy = Math.floor(ty * TILE - cam.y);
      if (!blitTile(ctx, 'tile_ice', sx, sy, TILE)) {
        ctx.fillStyle = '#86a2b2';
        ctx.fillRect(sx, sy, TILE, TILE);
      }
    }
  }

  // Широкие «дороги» по льду — тёмные полосы
  for (let lane = -8; lane <= 8; lane++) {
    const h = hash(lane + 90, 3);
    const ang = ((h % 40) - 20) * 0.01;
    const y0 = lane * 420 - cam.y;
    ctx.save();
    ctx.translate(VIEW.w / 2, y0 + VIEW.h / 2);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(28, 48, 64, 0.07)';
    ctx.fillRect(-VIEW.w, -28, VIEW.w * 2, 56);
    ctx.fillStyle = 'rgba(220, 236, 246, 0.05)';
    ctx.fillRect(-VIEW.w, -6, VIEW.w * 2, 10);
    ctx.restore();
  }

  const qx0 = Math.floor(tx0 / 3);
  const qy0 = Math.floor(ty0 / 3);
  const qx1 = Math.floor(tx1 / 3);
  const qy1 = Math.floor(ty1 / 3);
  for (let qy = qy0; qy <= qy1; qy++) {
    for (let qx = qx0; qx <= qx1; qx++) {
      const h = hash(qx, qy);
      const tone = (h % 7) - 3;
      if (tone === 0) continue;
      const sx = Math.floor(qx * 3 * TILE - cam.x);
      const sy = Math.floor(qy * 3 * TILE - cam.y);
      ctx.fillStyle = tone > 0
        ? `rgba(236,246,252,${0.025 * tone})`
        : `rgba(18, 34, 48,${0.03 * -tone})`;
      ctx.fillRect(sx, sy, TILE * 3, TILE * 3);
      // редкие «лужи» блеска
      if ((h % 11) === 2) {
        ctx.fillStyle = 'rgba(180, 214, 230, 0.14)';
        ctx.beginPath();
        ctx.ellipse(sx + 40, sy + 36, 34, 16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.lineWidth = 1;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const h = hash(tx + 41, ty + 17);
      if ((h % 90) !== 7) continue;
      const sx = Math.floor(tx * TILE - cam.x);
      const sy = Math.floor(ty * TILE - cam.y);
      const cx = sx + 6 + (h % 14);
      const cy = sy + 8 + ((h >>> 5) % 12);
      ctx.strokeStyle = 'rgba(16, 26, 34, 0.35)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 11, cy + 3);
      ctx.lineTo(cx + 18, cy - 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(230, 242, 250, 0.22)';
      ctx.beginPath();
      ctx.moveTo(cx + 1, cy + 2);
      ctx.lineTo(cx + 12, cy + 5);
      ctx.stroke();
    }
  }
}

function visibleDecor(cam, solids) {
  const out = [];
  const gx0 = Math.floor((cam.x - 90) / DECOR_STEP);
  const gy0 = Math.floor((cam.y - 90) / DECOR_STEP);
  const gx1 = Math.floor((cam.x + VIEW.w + 90) / DECOR_STEP);
  const gy1 = Math.floor((cam.y + VIEW.h + 90) / DECOR_STEP);
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const h = hash(gx + 3, gy + 9);
      if ((h % 5) === 0) continue; // denser: skip only 1/5
      const x = gx * DECOR_STEP + 40 + (h % 200);
      const y = gy * DECOR_STEP + 36 + ((h >>> 8) % 180);
      if (x * x + y * y < CLEAR * CLEAR) continue;
      if (tooClose(solids, x, y, 56)) continue;
      const roll = h % 7;
      let kind = 'snow';
      if (roll === 0 || roll === 1) kind = 'banner';
      else if (roll === 2) kind = 'crack';
      else if (roll === 3) kind = 'icechunk';
      out.push({ x, y, kind, block: false, salt: (h % 628) / 100 });
    }
  }
  return out;
}

function drawCrack(ctx, sx, sy, salt) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.strokeStyle = 'rgba(20, 34, 48, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-18, -2);
  ctx.lineTo(-4, 3);
  ctx.lineTo(8, -1);
  ctx.lineTo(20, 4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(210, 230, 240, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-16, 2);
  ctx.lineTo(6, 6 + (salt % 3));
  ctx.lineTo(18, 1);
  ctx.stroke();
  ctx.restore();
}

function drawIceChunk(ctx, sx, sy) {
  shadow(ctx, sx, sy, 18, 6);
  if (blitProp(ctx, 'prop_ice', Math.round(sx - 32), Math.round(sy - 40), 64)) return;
  ctx.fillStyle = '#9ec4d4';
  ctx.beginPath();
  ctx.moveTo(sx - 18, sy);
  ctx.lineTo(sx - 6, sy - 22);
  ctx.lineTo(sx + 14, sy - 16);
  ctx.lineTo(sx + 20, sy + 2);
  ctx.lineTo(sx - 10, sy + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(sx - 4, sy - 16, 6, 3);
}

function drawSnowfall(ctx, cam, t) {
  const spanX = VIEW.w + 32;
  const spanY = VIEW.h + 32;
  for (let i = 0; i < 70; i++) {
    const depth = 0.12 + (i % 5) * 0.07;
    const spd = 10 + (i % 4) * 7;
    const sx = ((i * 211 + t * spd * 0.4 - cam.x * depth) % spanX + spanX) % spanX - 16;
    const sy = ((i * 137 + t * spd - cam.y * depth) % spanY + spanY) % spanY - 16;
    const big = i % 8 === 0;
    ctx.fillStyle = big ? 'rgba(246, 251, 255, 0.5)' : 'rgba(226, 238, 246, 0.3)';
    ctx.fillRect(sx | 0, sy | 0, big ? 2 : 1, big ? 3 : 1);
  }
}

export function drawWorld(ctx, cam, map, t, hazards = [], solids = []) {
  ctx.imageSmoothingEnabled = false;
  drawIce(ctx, cam, map);

  const pad = 96;
  for (let i = 0; i < hazards.length; i++) {
    const hz = hazards[i];
    const hx = hz.x - cam.x;
    const hy = hz.y - cam.y;
    const r = hz.r || 36;
    if (hx < -r - pad || hy < -r - pad || hx > VIEW.w + r + pad || hy > VIEW.h + r + pad) continue;
    if (hz.kind === 'slip') drawSlip(ctx, hx, hy, r);
    else if (hz.kind === 'polynya') drawPolynya(ctx, hx, hy, r);
  }

  const x0 = cam.x - pad;
  const y0 = cam.y - pad;
  const x1 = cam.x + VIEW.w + pad;
  const y1 = cam.y + VIEW.h + pad;
  const batch = [];
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (!s || s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
    batch.push(s);
  }
  const decor = visibleDecor(cam, solids);
  for (let i = 0; i < decor.length; i++) batch.push(decor[i]);
  batch.sort((a, b) => a.y - b.y);

  for (let i = 0; i < batch.length; i++) {
    const p = batch[i];
    const sx = p.x - cam.x;
    const sy = p.y - cam.y;
    if (p.kind === 'banner') drawBanner(ctx, p, sx, sy);
    else if (p.kind === 'snow') drawSnow(ctx, sx, sy);
    else if (p.kind === 'crack') drawCrack(ctx, sx, sy, p.salt || 0);
    else if (p.kind === 'icechunk') drawIceChunk(ctx, sx, sy);
    else drawSolidProp(ctx, p, sx, sy);
  }

  drawSnowfall(ctx, cam, t);

  const vig = ctx.createRadialGradient(
    VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.38,
    VIEW.w / 2, VIEW.h / 2, VIEW.w * 0.68,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(8,16,24,0.16)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
}

/** Контуры солидов. Сам по себе не вызывается из drawWorld. */
export function drawSolidDebug(ctx, cam, solids = []) {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 72, 64, 0.55)';
  ctx.fillStyle = 'rgba(255, 72, 64, 0.08)';
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (!s || s.block === false) continue;
    const sx = s.x - cam.x;
    const sy = s.y - cam.y;
    if (sx < -80 || sy < -80 || sx > VIEW.w + 80 || sy > VIEW.h + 80) continue;
    ctx.beginPath();
    ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
