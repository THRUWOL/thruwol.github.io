/** Сочные частицы и следы способностей — поверх спрайтов. */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function px(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0));
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

/** Wood / beer-barrel browns (bochonok, taran). Foam golds stay false. */
function isBarrelTone(color) {
  if (typeof color !== 'string' || color[0] !== '#' || color.length < 7) return false;
  const n = parseInt(color.slice(1, 7), 16);
  if (!Number.isFinite(n)) return false;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return r > 110 && g > 60 && b < 110 && r >= g && g > b && (r - b) > 70;
}

function drawStave(ctx, x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#6b3e1c';
  ctx.fillRect(-6, -3, 12, 6);
  ctx.fillStyle = '#d7a05a';
  ctx.fillRect(-6, -3, 3, 6);
  ctx.fillStyle = '#f0d080';
  ctx.fillRect(-5, -1, 10, 2);
  ctx.restore();
}

export class Vfx {
  constructor() {
    this.parts = [];
    this.ribbons = [];
    this.flashes = [];
    this.slashes = [];
  }

  clear() {
    this.parts.length = 0;
    this.ribbons.length = 0;
    this.flashes.length = 0;
    this.slashes.length = 0;
  }

  burst(x, y, opts = {}) {
    const n = opts.n ?? 10;
    const color = opts.color || '#e8c878';
    const color2 = opts.color2 || '#fff8e0';
    const spd = opts.spd ?? 140;
    const life = opts.life ?? 0.45;
    const size = opts.size ?? 3;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const s = spd * (0.4 + Math.random() * 0.8);
      this.parts.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life, max: life,
        w: size + (Math.random() * 2) | 0,
        color: Math.random() < 0.45 ? color2 : color,
        g: opts.g ?? 180,
        kind: opts.kind || 'pixel',
      });
    }
  }

  foam(x, y, n = 14) {
    this.burst(x, y, { n, color: '#e8e0c0', color2: '#ffffff', spd: 110, life: 0.75, size: 5, g: 55, kind: 'foam' });
    for (let i = 0; i < Math.max(4, (n / 2) | 0); i++) {
      const a = Math.random() * Math.PI * 2;
      this.parts.push({
        x: x + Math.cos(a) * 6,
        y: y + Math.sin(a) * 4,
        vx: Math.cos(a) * 40,
        vy: -30 - Math.random() * 40,
        life: 0.55,
        max: 0.55,
        w: 3 + (i % 3),
        color: i % 2 ? '#fff' : '#f4e8c8',
        g: 120,
        kind: 'foam',
      });
    }
  }

  sparks(x, y, color = '#90c060') {
    this.burst(x, y, { n: 8, color, color2: '#e0f090', spd: 200, life: 0.35, size: 2, g: 60 });
  }

  trail(x, y, color, vx = 0, vy = 0) {
    this.parts.push({
      x, y, vx: vx * -0.1 + (Math.random() - 0.5) * 20, vy: vy * -0.1 + (Math.random() - 0.5) * 20,
      life: 0.28, max: 0.28, w: 4, color, g: 0, kind: 'trail',
    });
  }

  /** Thick foam crescent for the mug whip — filled wedge, not a hairline. */
  slash(x, y, a0, a1, r, color = '#e8c878') {
    const inner = Math.max(8, r * 0.36);
    this.slashes.push({
      x, y, a0, a1, r, r0: inner, color,
      life: 0.32, max: 0.32,
      width: 16,
    });
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      const u = i / (steps - 1);
      const a = a0 + (a1 - a0) * u;
      const rad = r * (0.76 + (i % 3) * 0.07);
      this.parts.push({
        x: x + Math.cos(a) * rad,
        y: y + Math.sin(a) * rad,
        vx: Math.cos(a) * (28 + (i % 4) * 14) + (Math.random() - 0.5) * 22,
        vy: Math.sin(a) * 22 + 36 + Math.random() * 48,
        life: 0.42, max: 0.42,
        w: 3 + (i % 3),
        color: i % 2 ? '#fffef8' : '#ffe9b0',
        g: 170,
        kind: 'foam',
      });
    }
    const mid = (a0 + a1) / 2;
    this.flashes.push({
      x: x + Math.cos(mid) * r * 0.62,
      y: y + Math.sin(mid) * r * 0.62,
      life: 0.12, max: 0.12,
      r: Math.max(16, r * 0.18),
      color,
    });
  }

  /** Expanding ring. Barrel-colored blasts throw tumbling staves. */
  ringBurst(x, y, color = '#e8c878') {
    const wood = isBarrelTone(color);
    this.ribbons.push({
      x, y, r: 8, vr: wood ? 200 : 220, life: 0.45, max: 0.45,
      color, width: wood ? 4 : 3,
      kind: wood ? 'barrelRing' : 'spinRing',
      spin: wood ? 11 : 7,
    });
    if (wood) {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 + Math.random() * 0.25;
        const s = 150 + Math.random() * 80;
        this.parts.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - 40,
          life: 0.55, max: 0.55,
          w: 10,
          color: '#7a4c28',
          color2: '#e8c060',
          g: 260,
          kind: 'barrel',
          spin: 8 + Math.random() * 6,
          rot: Math.random() * 6.28,
        });
      }
    }
    this.burst(x, y, { n: 12, color, color2: '#fff', spd: 160, life: 0.4 });
  }

  impact(x, y, color) {
    this.flashes.push({ x, y, life: 0.1, max: 0.1, r: 14, color: color || '#fff' });
    this.burst(x, y, { n: 6, color: color || '#e8c878', color2: '#fff', spd: 120, life: 0.28, size: 2, g: 100 });
  }

  dashGhost(x, y, facing, color) {
    this.parts.push({
      x, y, vx: 0, vy: 0, life: 0.25, max: 0.25, w: 20, color, g: 0, kind: 'ghost', facing,
    });
  }

  berserkWave(x, y) {
    this.ribbons.push({ x, y, r: 16, vr: 280, life: 0.55, max: 0.55, color: '#e89030', width: 5 });
    this.ribbons.push({ x, y, r: 8, vr: 200, life: 0.45, max: 0.45, color: '#ffe080', width: 3 });
    this.burst(x, y, { n: 24, color: '#e87020', color2: '#ffe090', spd: 260, life: 0.55, size: 4, g: 80 });
    this.flashes.push({ x, y, life: 0.2, max: 0.2, r: 50, color: '#e89040' });
  }

  chainBolt(x1, y1, x2, y2, color = '#c0e060') {
    this.ribbons.push({
      kind: 'bolt', x: x1, y: y1, x2, y2, color, life: 0.28, max: 0.28, width: 6,
    });
    this.ribbons.push({
      kind: 'bolt', x: x1, y: y1, x2, y2, color: '#f4ffe0', life: 0.16, max: 0.16, width: 2,
    });
    const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 18;
    const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * 18;
    this.ribbons.push({
      kind: 'bolt', x: x1, y: y1, x2: midX, y2: midY, color, life: 0.2, max: 0.2, width: 4,
    });
    this.ribbons.push({
      kind: 'bolt', x: midX, y: midY, x2, y2, color, life: 0.2, max: 0.2, width: 4,
    });
    this.sparks(x2, y2, color);
    this.foam(x2, y2, 6);
  }

  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'foam') {
        p.vx *= 0.96;
        p.vy *= 0.96;
      } else if (p.kind === 'barrel') {
        p.rot = (p.rot || 0) + dt * (p.spin || 10);
      }
    }
    this.parts = this.parts.filter((p) => p.life > 0);

    for (const s of this.slashes) s.life -= dt;
    this.slashes = this.slashes.filter((s) => s.life > 0);

    for (const f of this.flashes) f.life -= dt;
    this.flashes = this.flashes.filter((f) => f.life > 0);

    for (const r of this.ribbons) {
      r.life -= dt;
      if (r.vr) r.r += r.vr * dt;
    }
    this.ribbons = this.ribbons.filter((r) => r.life > 0);

    if (this.parts.length > 420) this.parts.splice(0, this.parts.length - 420);
  }

  draw(ctx, cam) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    for (const f of this.flashes) {
      const a = clamp(f.life / f.max, 0, 1);
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(f.x - cam.x, f.y - cam.y, f.r * (1.2 - a * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const s of this.slashes) {
      const a = clamp(s.life / s.max, 0, 1);
      const x = s.x - cam.x;
      const y = s.y - cam.y;
      const outer = s.r;
      const inner = s.r0 ?? outer * 0.36;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.imageSmoothingEnabled = false;
      wedge(ctx, x, y, inner * 0.72, outer + 4, s.a0, s.a1, 'rgba(40,22,10,0.4)');
      wedge(ctx, x, y, inner, outer * 0.88, s.a0 + 0.03, s.a1 - 0.03, s.color);
      wedge(ctx, x, y, outer * 0.7, outer, s.a0, s.a1, '#fff6e0');
      wedge(ctx, x, y, inner, inner + 5, s.a0 + 0.05, s.a1 - 0.05, 'rgba(255,252,244,0.95)');
      const steps = 8;
      for (let i = 0; i < steps; i++) {
        const ang = s.a0 + (s.a1 - s.a0) * (i / (steps - 1));
        const rad = outer * (0.86 + (i % 2) * 0.05);
        const sz = 2 + (i % 3);
        px(ctx, x + Math.cos(ang) * rad - sz / 2, y + Math.sin(ang) * rad - sz / 2, sz, sz, i % 2 ? '#fff' : '#fff1cc');
        const drip = ((1 - a) * 14 + i * 3) % 10;
        px(ctx, x + Math.cos(ang) * (outer * 0.72), y + Math.sin(ang) * (outer * 0.72) + drip, 2, 3, '#fff8ec');
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    for (const r of this.ribbons) {
      const a = clamp(r.life / r.max, 0, 1);
      ctx.globalAlpha = a;
      if (r.kind === 'bolt') {
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.width;
        ctx.beginPath();
        const x1 = r.x - cam.x; const y1 = r.y - cam.y;
        const x2 = r.x2 - cam.x; const y2 = r.y2 - cam.y;
        const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * 12;
        const my = (y1 + y2) / 2 + (Math.random() - 0.5) * 12;
        ctx.moveTo(x1, y1);
        ctx.lineTo(mx, my);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.strokeStyle = '#f0ffe0';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (r.kind === 'barrelRing' || r.kind === 'spinRing') {
        const cx = r.x - cam.x;
        const cy = r.y - cam.y;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.width;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, r.r), 0, Math.PI * 2);
        ctx.stroke();
        const spin = (1 - a) * (r.spin || 8);
        if (r.kind === 'barrelRing') {
          ctx.strokeStyle = '#f0d080';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(1, r.r - 4), 0, Math.PI * 2);
          ctx.stroke();
          const n = 6;
          for (let i = 0; i < n; i++) {
            const ang = spin + (i / n) * Math.PI * 2;
            drawStave(ctx, cx + Math.cos(ang) * r.r, cy + Math.sin(ang) * r.r, ang + spin);
          }
        } else {
          for (let i = 0; i < 10; i++) {
            const ang = spin + (i / 10) * Math.PI * 2;
            px(ctx, cx + Math.cos(ang) * r.r - 1, cy + Math.sin(ang) * r.r - 1, 3, 3, i % 2 ? '#fff' : r.color);
          }
        }
      } else {
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.width;
        ctx.beginPath();
        ctx.arc(r.x - cam.x, r.y - cam.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    for (const p of this.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      const x = p.x - cam.x;
      const y = p.y - cam.y;
      ctx.globalAlpha = a;
      if (p.kind === 'ghost') {
        ctx.globalAlpha = a * 0.35;
        px(ctx, x - 10, y - 14, 20, 28, p.color);
      } else if (p.kind === 'foam') {
        px(ctx, x - p.w / 2, y - p.w / 2, p.w + 1, p.w, p.color);
        px(ctx, x - 1, y - p.w / 2 - 1, 2, 2, '#fff');
      } else if (p.kind === 'trail') {
        px(ctx, x - 2, y - 2, 4, 4, p.color);
      } else if (p.kind === 'barrel') {
        drawStave(ctx, x, y, p.rot || 0);
      } else {
        px(ctx, x, y, p.w, p.w, p.color);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

/** Рисование снарядов с формой по оружию — если art.drawProj слишком простой. */
export function drawFancyProj(ctx, p, cam, t) {
  const x = p.x - cam.x;
  const y = p.y - cam.y;
  if (p.kind === 'arc') return;
  ctx.save();
  ctx.translate(x, y);
  if (p.vx || p.vy) ctx.rotate(Math.atan2(p.vy || 0, p.vx || 1));
  ctx.imageSmoothingEnabled = false;
  const c = p.color || '#d0e8ff';

  if (p.shape === 'barrel' || p.vis === 'barrel') {
    px(ctx, -7, -5, 14, 10, '#8a6030');
    px(ctx, -7, -2, 14, 2, '#c0a050');
    px(ctx, -7, 2, 14, 2, '#c0a050');
    px(ctx, -5, -4, 2, 8, '#6a4020');
  } else if (p.shape === 'foam' || p.slow) {
    px(ctx, -6, -5, 12, 10, '#e8e0c0');
    px(ctx, -4, -7, 8, 4, '#fff');
    px(ctx, -2, -2, 4, 4, '#d8d0a8');
  } else if (p.shape === 'bottle' || p.vis === 'bottle') {
    px(ctx, -3, -8, 6, 14, c);
    px(ctx, -2, -10, 4, 3, '#eee');
    px(ctx, -1, 2, 2, 4, '#fff8');
  } else if (p.shape === 'mug' || p.vis === 'mug') {
    px(ctx, -6, -6, 10, 12, '#c8a050');
    px(ctx, -4, -8, 6, 3, '#fff8e0');
    px(ctx, 4, -2, 4, 6, '#a08040');
  } else if (p.shape === 'hop' || p.vis === 'hop') {
    px(ctx, -4, -4, 8, 8, '#80b050');
    px(ctx, -2, -6, 4, 3, '#a0d060');
  } else if (p.kind === 'enemy') {
    px(ctx, -3, -7, 6, 14, c);
    px(ctx, -2, -9, 4, 3, '#eee');
  } else {
    // spinning diamond bolt
    const pulse = 1 + Math.sin(t * 20) * 0.15;
    px(ctx, -4 * pulse, -3, 8 * pulse, 6, c);
    px(ctx, -2, -5, 4, 2, '#fff');
  }
  ctx.restore();
}
