/** VS-style actors: heroes bob or short-walk. Weapons animate themselves. */
import { spr, animKey } from './sprites.js';

const HERO_SCALE = 1;

function px(ctx, x, y, w, h, c) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = c;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

function shadow(ctx, x, y, rx, ry) {
  ctx.save();
  ctx.fillStyle = 'rgba(6,10,16,.38)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function wedge(ctx, x, y, r0, r1, a0, a1, color) {
  if (!(r1 > 1)) return;
  let s0 = a0;
  let s1 = a1;
  if (s1 < s0) {
    const tmp = s0;
    s0 = s1;
    s1 = tmp;
  }
  ctx.beginPath();
  ctx.arc(x, y, r1, s0, s1);
  ctx.arc(x, y, Math.max(1, r0), s1, s0, true);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Feet at (x, y), sprite grows upward. Integer scale only. */
function paintSprite(ctx, img, x, y, facing, scale, alpha, rot) {
  if (!img) return null;
  const s = Math.max(1, Math.round(scale));
  const w = img.width * s;
  const h = img.height * s;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(y));
  if (rot) ctx.rotate(rot);
  if (facing < 0) ctx.scale(-1, 1);
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, -Math.floor(w / 2), -h, w, h);
  ctx.restore();
  return { w, h };
}

function whiteWash(ctx, x, y, w, h, amount) {
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.fillStyle = '#fff';
  const bw = Math.max(8, w * 0.68);
  const bh = Math.max(10, h * 0.76);
  ctx.fillRect(Math.round(x - bw / 2), Math.round(y - h + h * 0.08), bw, bh);
  ctx.restore();
}

function drawFallbackHero(ctx, id) {
  const coat = id === 'gopnik' ? '#2f6a34' : id === 'semeon' ? '#3a4e64' : '#8a5228';
  const hat = id === 'gopnik' ? '#1a1c18' : id === 'semeon' ? '#243444' : '#2c221c';
  px(ctx, -6, -12, 4, 12, '#2a2018');
  px(ctx, 2, -12, 4, 12, '#2a2018');
  px(ctx, -7, -10, 5, 3, '#d8d0c4');
  px(ctx, 2, -10, 5, 3, '#d8d0c4');
  px(ctx, -8, -32, 16, 20, coat);
  if (id === 'gopnik') px(ctx, -1, -30, 2, 16, '#eef6d8');
  else if (id === 'semeon') px(ctx, -3, -28, 6, 12, '#c8d0d4');
  else px(ctx, -3, -16, 6, 3, '#e8b43c');
  px(ctx, -5, -42, 10, 10, '#f2c4a2');
  px(ctx, -6, -48, 12, 7, hat);
  px(ctx, -3, -38, 2, 2, '#1a120e');
  px(ctx, 2, -38, 2, 2, '#1a120e');
  if (id === 'kirill') px(ctx, -5, -34, 10, 4, '#e4bc8a');
}

function drawFallbackEnemy(ctx, e) {
  const c = e.color || '#8a5060';
  px(ctx, -4, -12, 3, 8, '#241c18');
  px(ctx, 1, -12, 3, 8, '#241c18');
  px(ctx, -6, -26, 12, 14, c);
  px(ctx, -4, -34, 8, 8, '#e0b090');
  px(ctx, -3, -31, 2, 2, '#1a120e');
  px(ctx, 1, -31, 2, 2, '#1a120e');
}

function hpBar(ctx, x, y, w, frac) {
  const f = Math.max(0, Math.min(1, frac || 0));
  px(ctx, x - 1, y - 1, w + 2, 5, '#0c0e12');
  px(ctx, x, y, w, 3, '#3a1418');
  const fw = Math.round(w * f);
  if (fw > 0) {
    px(ctx, x, y, fw, 3, f > 0.35 ? '#d04848' : '#e8c040');
    px(ctx, x, y, fw, 1, 'rgba(255,255,255,.45)');
  }
}

/**
 * Idle portrait, or Kirill's 4-frame walk at 8fps.
 * Other heroes bob only. No attack frames. HP bar sits above the sprite.
 */
export function drawHero(ctx, ch, x, y, facing, moving, t, dashing, berserk, hp = 1, maxHp = 1) {
  ctx.imageSmoothingEnabled = false;
  const id = (ch && ch.id) || 'kirill';
  const face = facing < 0 ? -1 : 1;
  const time = Number.isFinite(t) ? t : 0;
  let key = id;
  let walking = false;
  if (id === 'kirill' && moving) {
    const wk = animKey('kirill_walk', Math.floor(time * 8));
    if (wk) {
      key = wk;
      walking = true;
    }
  }
  const img = spr(key) || spr(id);
  const bob = Math.round(Math.sin(time * (moving ? 11 : 2.6)) * (walking ? 1 : moving ? 2 : 1));
  const footX = Math.round(x);
  const footY = Math.round(y + 8 + bob);

  shadow(ctx, footX, footY + 1, 11, 4);

  let box = { w: 48, h: 64 };
  const paint = (ox, alpha) => {
    if (img) {
      const b = paintSprite(ctx, img, footX + ox, footY, face, HERO_SCALE, alpha, 0);
      if (ox === 0 && b) box = b;
      return;
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(footX + ox, footY);
    ctx.scale(face, 1);
    ctx.globalAlpha = alpha;
    drawFallbackHero(ctx, id);
    ctx.restore();
  };

  if (dashing) {
    paint(-face * 16, 0.18);
    paint(-face * 8, 0.36);
  }
  paint(0, 1);

  if (berserk) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.strokeStyle = 'rgba(255,128,36,.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(footX, footY - Math.round(box.h * 0.5), Math.round(box.w * 0.42), Math.round(box.h * 0.52), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const frac = maxHp > 0 ? hp / maxHp : 0;
  hpBar(ctx, footX - 18, footY - box.h - 8, 36, frac);
}

/** Own portrait per id + bob. No shared Kirill-like walk sheet. */
export function drawEnemy(ctx, e, cam, t) {
  if (!e) return;
  ctx.imageSmoothingEnabled = false;
  const time = Number.isFinite(t) ? t : 0;
  const sx = Math.round(e.x - (cam ? cam.x : 0));
  const sy = Math.round(e.y - (cam ? cam.y : 0));
  const moving = Math.hypot(e.fx || 0, e.fy || 0) > 0.4 || (e.speed ?? 1) > 1;
  const bob = Math.round(Math.sin(time * 7 + (e.x || 0) * 0.04) * (moving ? 1.6 : 0.5));
  const lunging = !!(e.charge && e.chargeT > 1.25 && e.chargeDir);
  const face = (e.fx || 0) !== 0
    ? ((e.fx || 0) >= 0 ? 1 : -1)
    : (e.chargeDir && e.chargeDir.x
      ? (e.chargeDir.x >= 0 ? 1 : -1)
      : 1);
  const footX = sx + (lunging ? face * 6 : 0);
  const footY = sy + 8 + bob;
  const boss = !!(e.boss || e.id === 'khmeldorf');
  const elite = !!e.elite;
  const reaper = !!e.reaper || e.id === 'zhnec';
  // Only integer scales — fractional scale caused torn “ghost strips”.
  const scale = boss ? 2 : reaper ? 2 : 1;

  let img = spr(e.id);
  const walkKey = animKey(`${e.id}_walk`, Math.floor(time * 8));
  if (moving && walkKey) img = spr(walkKey) || img;

  shadow(ctx, footX, footY + 1, boss ? 16 : elite ? 12 : 10, boss ? 5 : 3);

  let box = null;
  if (img) {
    box = paintSprite(ctx, img, footX, footY, face, scale, 1, 0);
    if (e.hitFlash > 0) {
      // Soft white flash without 'lighter' (that bled bright strips on ice).
      whiteWash(ctx, footX, footY, box.w, box.h, Math.min(0.45, e.hitFlash * 4));
    }
  } else {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(footX, footY);
    ctx.scale(face, 1);
    drawFallbackEnemy(ctx, e);
    ctx.restore();
    box = { w: 28, h: 40 };
  }

  if (e.slowT > 0) {
    px(ctx, footX - 8, footY - 2, 4, 3, 'rgba(255,248,230,.8)');
    px(ctx, footX + 4, footY, 3, 2, 'rgba(255,248,230,.6)');
    px(ctx, footX - 1, footY - 4, 2, 2, '#fff');
  }
  if (e.buff || e.id === 'znamenosets') {
    ctx.save();
    ctx.strokeStyle = `rgba(230,190,70,${0.35 + Math.sin(time * 5) * 0.12})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(footX, footY, 14, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (elite) {
    ctx.save();
    ctx.strokeStyle = `rgba(255,210,90,${0.55 + Math.sin(time * 6) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(footX, footY - (box ? box.h : 40) - 6, 10, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f0d080';
    ctx.fillRect(footX - 2, footY - (box ? box.h : 40) - 14, 4, 6);
    ctx.restore();
  }
  if (lunging) {
    for (let i = 0; i < 3; i++) {
      px(ctx, footX - face * (10 + i * 6), footY - 4 + (i & 1) * 2, 4, 2, 'rgba(210,228,236,.55)');
    }
  }
  if (e.maxHp && e.hp < e.maxHp) {
    const w = boss ? 44 : 24;
    const top = (box ? box.h : 48) + 6;
    hpBar(ctx, footX - (w / 2 | 0), footY - top, w, e.hp / e.maxHp);
  }
}

function spinAge(p, t) {
  if (typeof p.age === 'number' && Number.isFinite(p.age)) return p.age;
  if (typeof t === 'number' && Number.isFinite(t)) return t;
  return typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
}

function drawBarrelPx(ctx) {
  px(ctx, -8, -6, 16, 12, '#3a2414');
  px(ctx, -7, -5, 14, 10, '#8a5428');
  px(ctx, -7, -5, 2, 10, '#e0a868');
  px(ctx, 5, -5, 2, 10, '#4a2c16');
  px(ctx, -7, -2, 14, 2, '#f0d080');
  px(ctx, -7, 2, 14, 2, '#a07028');
  px(ctx, -5, -4, 3, 2, '#c48a4c');
  px(ctx, -2, -7, 4, 2, '#f7f1e4');
}

function drawMugPx(ctx) {
  px(ctx, -5, -5, 9, 11, '#a07028');
  px(ctx, -4, -4, 7, 9, '#e0b050');
  px(ctx, -4, -8, 7, 4, '#fff6e4');
  px(ctx, -3, -9, 5, 2, '#fff');
  px(ctx, -3, -3, 2, 6, '#fff1c4');
  px(ctx, 4, -2, 3, 6, '#8a5c20');
  px(ctx, 5, -1, 2, 4, '#c89840');
}

function drawFoamPx(ctx) {
  px(ctx, -8, -5, 16, 10, '#d9d0b4');
  px(ctx, -6, -8, 12, 8, '#f4efe2');
  px(ctx, -3, -11, 8, 5, '#fff');
  px(ctx, 4, -7, 5, 5, '#fff');
  px(ctx, -9, -1, 4, 4, '#e4d8bc');
  px(ctx, -2, -6, 3, 2, '#fff');
  px(ctx, 1, -3, 3, 3, '#cbb98a');
}

function drawBottlePx(ctx) {
  px(ctx, -3, -15, 6, 3, '#f4f0e4');
  px(ctx, -2, -17, 4, 2, '#fff');
  px(ctx, -2, -12, 4, 3, '#d8ecf0');
  px(ctx, -1, -14, 2, 2, '#c8a050');
  px(ctx, -4, -9, 8, 14, '#3a8a48');
  px(ctx, -3, -8, 2, 9, 'rgba(255,255,255,.55)');
  px(ctx, -4, -3, 8, 4, '#e8d090');
  px(ctx, -3, -2, 3, 2, '#c04030');
  px(ctx, -4, 3, 8, 2, '#1e5030');
}

function drawEnemyBottlePx(ctx, tint) {
  const glass = tint || '#6a90b0';
  px(ctx, -2, -14, 4, 3, '#d8dce0');
  px(ctx, -1, -11, 2, 4, '#c5d0d8');
  px(ctx, -4, -7, 8, 15, glass);
  px(ctx, -3, -6, 2, 10, 'rgba(255,255,255,.5)');
  px(ctx, -4, -1, 8, 4, '#1c2830');
  px(ctx, -3, 0, 5, 1, '#f2f2f2');
  px(ctx, -4, 6, 8, 2, '#243240');
}

function drawHopPx(ctx) {
  px(ctx, -1, -9, 3, 2, '#f4f8e0');
  px(ctx, -3, -7, 6, 3, '#d8ec90');
  px(ctx, -5, -4, 10, 3, '#b4d25c');
  px(ctx, -6, -1, 12, 3, '#5a8228');
  px(ctx, -4, 2, 8, 3, '#3a6818');
  px(ctx, -2, 5, 4, 3, '#6a9a30');
  px(ctx, -1, 8, 2, 3, '#2e4816');
  px(ctx, -4, -2, 2, 2, '#e8f4b0');
  px(ctx, 2, 1, 2, 2, '#d8ec90');
}

function drawSicklePx(ctx, color) {
  const col = color || '#c0d080';
  px(ctx, -8, -1, 8, 3, '#6a5030');
  px(ctx, -1, -6, 3, 8, '#222');
  px(ctx, 0, -7, 8, 3, col);
  px(ctx, 6, -9, 3, 4, col);
  px(ctx, 7, -9, 2, 2, '#fff');
}

function drawBoltPx(ctx, color) {
  const c = color || '#d0e8ff';
  px(ctx, -8, -2, 12, 4, c);
  px(ctx, 2, -3, 5, 6, c);
  px(ctx, 6, -1, 3, 2, '#fff');
  px(ctx, -4, -3, 4, 2, '#fff');
}

function drawSpinning(ctx, age, spin, drawFn, ghosts) {
  const n = ghosts | 0;
  for (let i = n; i >= 1; i--) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(-i * 11, Math.sin(age * 14 + i) * 1.5);
    ctx.globalAlpha = 0.14 + (n - i) * 0.08;
    ctx.rotate(age * spin - i * 0.6);
    ctx.scale(2, 2);
    drawFn(ctx);
    ctx.restore();
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.rotate(age * spin);
  ctx.scale(2, 2);
  drawFn(ctx);
  ctx.restore();
}

function mist(ctx, age, tint) {
  for (let i = 0; i < 4; i++) {
    ctx.globalAlpha = 0.28 + (i % 2) * 0.12;
    px(ctx, -16 - i * 8, Math.sin(age * 20 + i) * 3, 3, 2, i % 2 ? '#fff6e0' : tint);
  }
  ctx.globalAlpha = 1;
}

function drawFoamBolt(ctx, p, age, aim) {
  const phase = age;
  for (let i = 0; i < 5; i++) {
    const fall = (phase * 34 + i * 11) % 18;
    const ox = Math.sin(phase * 5 + i) * 4 + (i - 2) * 3;
    ctx.globalAlpha = 0.55 + (i % 2) * 0.25;
    px(ctx, ox - 1, 6 + fall, 2, 3 + (i & 1), i % 2 ? '#fff' : '#e7dcc4');
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.rotate(aim);
  const pulse = 1 + Math.sin(phase * 10) * 0.16;
  const bulk = Math.max(0.85, Math.min(1.4, (p.r || 12) / 12));
  ctx.scale(2 * pulse * bulk, 2 * pulse * 0.92 * bulk);
  drawFoamPx(ctx);
  ctx.restore();
}

/** Thick beer-foam crescent. Fades with p.life (arcs live ~0.22s). */
function drawFoamWedge(ctx, x, y, p, age) {
  const aim = Number.isFinite(p.a) ? p.a : Math.atan2(p.vy || 0, p.vx || 1);
  const spread = 0.72;
  const a0 = aim - spread;
  const a1 = aim + spread;
  const outer = Math.max(28, p.r || 96);
  const inner = outer * 0.3;
  const life = typeof p.life === 'number' ? p.life : 0.22;
  const fade = Math.max(0, Math.min(1, life / 0.22));
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = fade;
  ctx.imageSmoothingEnabled = false;

  wedge(ctx, 0, 0, inner * 0.7, outer + 5, a0, a1, 'rgba(48,28,12,0.4)');
  wedge(ctx, 0, 0, inner, outer * 0.9, a0 + 0.03, a1 - 0.03, p.color || '#e8c878');
  const lip = outer * (0.74 + Math.sin(age * 28) * 0.02);
  wedge(ctx, 0, 0, lip, outer, a0, a1, '#fff6e6');
  wedge(ctx, 0, 0, inner, inner + Math.max(4, outer * 0.06), a0 + 0.05, a1 - 0.05, 'rgba(255,252,244,0.95)');

  for (let i = 0; i < 10; i++) {
    const u = i / 9;
    const ang = a0 + (a1 - a0) * u + Math.sin(age * 20 + i) * 0.02;
    const rad = outer * (0.84 + (i % 3) * 0.045);
    const sz = 2 + (i % 3);
    px(ctx, Math.cos(ang) * rad - sz / 2, Math.sin(ang) * rad - sz / 2, sz, sz, i % 2 ? '#fff' : '#fff1cc');
    const drip = (age * 46 + i * 9) % 12;
    px(ctx, Math.cos(ang) * (outer * 0.7), Math.sin(ang) * (outer * 0.7) + drip, 2, 3, 'rgba(255,248,230,.92)');
  }

  ctx.save();
  ctx.translate(Math.cos(aim) * outer * 0.58, Math.sin(aim) * outer * 0.58);
  ctx.rotate(aim + age * 9);
  ctx.scale(2, 2);
  drawMugPx(ctx);
  ctx.restore();
  ctx.restore();
}

/**
 * Ability animation. Spin = p.age * rate when age is set, else clock time.
 * Barrel rate is 10 rad/s. Every bolt is aimed with atan2(vy, vx) first.
 * kind 'arc' is a filled foam wedge (game.js currently skips those — draw them here).
 */
export function drawProj(ctx, p, cam, t) {
  if (!p) return;
  const x = p.x - (cam ? cam.x : 0);
  const y = p.y - (cam ? cam.y : 0);
  const age = spinAge(p, t);
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  if (p.kind === 'arc' || p.shape === 'arc' || p.vis === 'arc') {
    drawFoamWedge(ctx, x, y, p, age);
    ctx.restore();
    return;
  }

  const shape = p.shape || p.vis || (p.slow ? 'foam' : 'bolt');
  const vx = p.vx || 0;
  const vy = p.vy || 0;
  const aim = Math.hypot(vx, vy) > 0.01 ? Math.atan2(vy, vx) : 0;

  ctx.translate(x, y);

  if (p.kind === 'enemy') {
    ctx.rotate(aim);
    mist(ctx, age, '#d5e4ee');
    drawSpinning(ctx, age, 5, (c) => drawEnemyBottlePx(c, p.color), 2);
  } else if (shape === 'barrel') {
    ctx.rotate(aim);
    mist(ctx, age, '#e2c888');
    drawSpinning(ctx, age, 10, drawBarrelPx, 3);
  } else if (shape === 'foam') {
    drawFoamBolt(ctx, p, age, aim);
  } else if (shape === 'bottle') {
    ctx.rotate(aim);
    mist(ctx, age, '#d8eccc');
    drawSpinning(ctx, age, 8, drawBottlePx, 2);
  } else if (shape === 'hop') {
    ctx.rotate(aim);
    ctx.translate(0, Math.sin(age * 8) * 2);
    drawSpinning(ctx, age, 7, drawHopPx, 2);
  } else if (shape === 'mug') {
    ctx.rotate(aim);
    mist(ctx, age, '#fff1cc');
    drawSpinning(ctx, age, 6, drawMugPx, 2);
  } else if (shape === 'serp' || shape === 'sickle') {
    ctx.rotate(aim + age * 12);
    ctx.scale(2, 2);
    drawSicklePx(ctx, p.color);
  } else {
    ctx.rotate(aim);
    const pulse = 1 + Math.sin(age * 16) * 0.12;
    ctx.scale(2 * pulse, 2);
    drawBoltPx(ctx, p.color);
  }
  ctx.restore();
}
