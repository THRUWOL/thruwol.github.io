import {
  VIEW, TIME_LIMIT, DASH, BERSERK, MAX_WEAPONS, MAX_PASSIVES, MAX_CHOICES,
  MAP, WEAPONS, PASSIVES, ENEMIES, WAVES, SPECIALS, MAP_EVENTS,
  xpCapForLevel, difficultyAt, weighted, charById, weaponColor,
} from './data.js';
import { metaBonuses, isWeaponUnlocked } from './meta.js';
import { drawGem, drawPickup, drawFx } from './art.js';
import { drawHero, drawEnemy, drawProj } from './anim_draw.js';
import { drawWorld, seedWorldSolids, resolveSolidCollision } from './world.js';
import { Vfx } from './vfx.js';
import { sfx } from './audio.js';

const W = VIEW.w;
const H = VIEW.h;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const len = (x, y) => Math.hypot(x, y) || 1;
const ang = (x, y) => Math.atan2(y, x);

function wDef(id) { return WEAPONS[id]; }
function pDef(id) { return PASSIVES[id]; }
function eDef(id) { return ENEMIES[id] || ENEMIES.oruzhenosets; }

function weaponLevelStats(id, level) {
  const d = wDef(id);
  const i = clamp((level | 0) - 1, 0, (d.max || 1) - 1);
  return {
    cd: d.cd[i] ?? d.cd[0],
    dmg: d.dmg[i] ?? d.dmg[0],
    area: d.area ? d.area[i] : 100,
    amount: d.amount ? d.amount[i] : 1,
    style: d.style,
    slow: d.slow || 0,
    color: weaponColor(id),
  };
}

export class Game {
  constructor(canvas, meta, opts, hooks = {}) {
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d');
    this.meta = meta;
    this.hooks = hooks;
    this.char = charById(opts.charId);
    this.map = MAP;
    this.keys = Object.create(null);
    this.pointer = { x: W / 2, y: H / 2 };
    this.paused = false;
    this.over = false;
    this.won = false;
    this.levelPick = null;
    this.time = 0;
    this.spawnAcc = 0;
    this.killCount = 0;
    this.killStreak = 0;
    this.streakTimer = 0;
    this.coinsRun = 0;
    this.specialDone = new Set();
    this.shake = 0;
    this.bonuses = metaBonuses(meta, this.char.id);
    this.player = this._makePlayer();
    this.player.invuln = 1.4;
    this.player.revivesLeft = this.bonuses.revive | 0;
    this.enemies = [];
    this.projectiles = [];
    this.gems = [];
    this.pickups = [];
    this.fx = [];
    this.orbits = [];
    this.hazards = [];
    this.solids = seedWorldSolids();
    this.vfx = new Vfx();
    this.cam = { x: 0, y: 0 };
    this.bossSpawned = false;
    this.bossKilled = false;
    this.pendingLevels = 0;
    this.vacuumT = 0;
    this.hitFlash = 0;
    this.victoryT = 0;
    this.timeUp = false;
    this.nextEventAt = MAP_EVENTS.firstAt;
    this.eventIndex = 0;
    this.event = null;
    this.zones = [];
    this.iceRadius = 5200;
    this.reaperSpawned = false;
    this.bossPhase = 1;
    this.trailAcc = 0;
    this._seedHazards();
    this._bind();
  }

  _makePlayer() {
    const start = this.char.start;
    const b = this.bonuses;
    const startLv = Math.min(wDef(start).max || 8, Math.max(1, b.startLevel | 0));
    return {
      x: 0, y: 0,
      facing: 1,
      moving: false,
      hp: this.char.hp + b.hp,
      maxHp: this.char.hp + b.hp,
      baseSpeed: this.char.speed * b.speed,
      speed: this.char.speed * b.speed,
      level: 1,
      xp: 0,
      xpNeed: xpCapForLevel(1),
      invuln: 0,
      dashCd: 0,
      dashT: 0,
      dashDir: { x: 1, y: 0 },
      berserkCd: 0,
      berserkT: 0,
      hasBerserk: !!this.char.berserk,
      weapons: [{ id: start, level: startLv, cd: 0 }],
      passives: [],
      magnet: 100 + (b.magnet || 0),
      area: 1 + (b.area || 0),
      cooldown: b.cooldown || 1,
      amount: 0,
      might: b.might,
      regen: b.regen || 0,
      luck: b.luck || 1,
      greed: b.greed || 1,
      armor: b.armor || 0,
      growth: 1.05,
      slip: 0,
      vx: 0, vy: 0,
      attackT: 0,
      revivesLeft: 0,
    };
  }

  _seedHazards() {
    for (let i = 0; i < 8; i++) {
      this.hazards.push({
        kind: 'slip',
        x: rand(-1100, 1100),
        y: rand(-850, 850),
        r: rand(40, 64),
      });
    }
    for (let i = 0; i < 4; i++) {
      this.hazards.push({
        kind: 'polynya',
        x: rand(-950, 950),
        y: rand(-700, 700),
        r: rand(30, 42),
        dmg: 8,
      });
    }
  }

  _bind() {
    this._onKey = (e) => {
      this.keys[e.code] = e.type === 'keydown';
      if (e.type === 'keydown') {
        if (e.code === 'Space') { e.preventDefault(); this.tryDash(); }
        if (e.code === 'KeyQ') { e.preventDefault(); this.tryBerserk(); }
        if (e.code === 'Escape' && !this.levelPick && !this.over) {
          this.paused = !this.paused;
          this.hooks.onPause?.(this.paused);
        }
      }
    };
    this._onMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width) * W;
      this.pointer.y = ((e.clientY - r.top) / r.height) * H;
    };
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKey);
    this.canvas.addEventListener('pointermove', this._onMove);
  }

  destroy() {
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKey);
    this.canvas.removeEventListener('pointermove', this._onMove);
  }

  tryDash() {
    const p = this.player;
    if (p.dashCd > 0 || p.dashT > 0 || this.paused || this.levelPick || this.over) return;
    let dx = 0; let dy = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) dy -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown) dy += 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) dx -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) dx += 1;
    if (!dx && !dy) {
      dx = this.pointer.x + this.cam.x - p.x;
      dy = this.pointer.y + this.cam.y - p.y;
    }
    const L = len(dx, dy);
    p.dashDir = { x: dx / L, y: dy / L };
    p.dashT = DASH.dur;
    p.dashCd = DASH.cd;
    p.invuln = Math.max(p.invuln, DASH.dur);
    sfx.dash();
    this.vfx.dashGhost(p.x, p.y, p.facing, this.char.color);
    this.vfx.burst(p.x, p.y, { n: 8, color: '#a0c8e0', color2: '#fff', spd: 100, life: 0.25, size: 2, g: 0 });
    if (this.char.trait === 'dash_barrel') {
      const a = Math.atan2(p.dashDir.y, p.dashDir.x);
      this.projectiles.push({
        x: p.x, y: p.y - 6,
        vx: Math.cos(a) * 280, vy: Math.sin(a) * 280 - 40,
        life: 1.1, r: 16, dmg: 22 * p.might, color: '#a87840',
        kind: 'bolt', hit: new Set(), pierce: 3, g: 420,
        explode: 36, shape: 'barrel', vis: 'barrel', age: 0, puddle: true,
      });
    }
    if (p.hasBerserk) sfx.lungul();
  }

  tryBerserk() {
    const p = this.player;
    if (!p.hasBerserk || p.berserkCd > 0 || this.paused || this.levelPick || this.over) return;
    p.berserkCd = BERSERK.cd;
    p.berserkT = BERSERK.dur;
    p.invuln = Math.max(p.invuln, BERSERK.dur);
    this.shake = 0.35;
    sfx.lungul();
    this.fx.push({ kind: 'berserk', x: p.x, y: p.y, r: 20, life: 0.5, vr: BERSERK.radius * 2 });
    this.fx.push({ kind: 'text', x: p.x, y: p.y - 50, text: 'ЛУНГ-ГУЛ!', life: 1.1, vy: -35 });
    this.vfx.berserkWave(p.x, p.y);
    this.vfx.foam(p.x, p.y, 20);
    p.attackT = Math.max(p.attackT, 0.4);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < BERSERK.radius + e.r) {
        this.hurtEnemy(e, 55 * p.might, true);
        const L = len(e.x - p.x, e.y - p.y) || 1;
        e.x += ((e.x - p.x) / L) * BERSERK.knock * 0.42;
        e.y += ((e.y - p.y) / L) * BERSERK.knock * 0.42;
        this.vfx.impact(e.x, e.y, '#e89040');
      }
    }
  }

  togglePause() {
    if (this.levelPick || this.over) return;
    this.paused = !this.paused;
    this.hooks.onPause?.(this.paused);
  }

  addXp(n) {
    const p = this.player;
    p.xp += n * p.growth;
    let gained = 0;
    while (p.xp >= p.xpNeed) {
      p.xp -= p.xpNeed;
      p.level++;
      p.xpNeed = xpCapForLevel(p.level);
      this.pendingLevels++;
      gained++;
    }
    if (gained) sfx.level();
    if (this.pendingLevels > 0 && !this.levelPick && !this.over) this.openLevelUp();
  }

  openLevelUp(opts) {
    if (this.over) return;
    if (!opts && this.pendingLevels <= 0) return;
    this.levelPick = opts || this._levelOptions();
    this.paused = true;
    this.hooks.onLevelUp?.(this.levelPick);
  }

  /** Сундук события: только апгрейд уже взятого снаряжения. */
  openGearChest() {
    const opts = this._gearUpgradeOptions();
    if (!opts.length) {
      this.pendingLevels++;
      this.openLevelUp();
      return;
    }
    this.fx.push({ kind: 'text', x: this.player.x, y: this.player.y - 50, text: 'СУНДУК СНАРЯЖЕНИЯ!', life: 1.6, vy: -25 });
    sfx.chest();
    this.openLevelUp(opts);
  }

  vacuumGems() {
    this.vacuumT = Math.max(this.vacuumT, 1.4);
    this.player.magnet = Math.max(this.player.magnet, 2400);
  }

  _weaponUpgradeCard(id, owned) {
    const w = WEAPONS[id];
    if (!w || !owned) return null;
    if (owned.level < w.max) {
      const next = weaponLevelStats(id, owned.level + 1);
      const cur = weaponLevelStats(id, owned.level);
      return {
        type: 'weapon', id, level: owned.level + 1, name: w.name,
        desc: `Ур. ${owned.level + 1}: урон ${cur.dmg}→${next.dmg}, кд ${cur.cd.toFixed(2)}→${next.cd.toFixed(2)}`,
        color: weaponColor(id),
      };
    }
    if (owned.level >= w.max && w.evolvesTo && w.needsPassive) {
      if (this.player.passives.find((x) => x.id === w.needsPassive) && !this.player.weapons.find((x) => x.id === w.evolvesTo)) {
        const ev = wDef(w.evolvesTo);
        return {
          type: 'evolve', id: w.evolvesTo, from: id,
          name: ev.name, desc: `Эволюция ${w.name}!`, color: weaponColor(w.evolvesTo),
        };
      }
    }
    return null;
  }

  _gearUpgradeOptions() {
    const p = this.player;
    const pool = [];
    for (const owned of p.weapons) {
      const card = this._weaponUpgradeCard(owned.id, owned);
      if (card) pool.push(card);
    }
    for (const owned of p.passives) {
      const pas = PASSIVES[owned.id];
      if (pas && owned.level < pas.max) {
        pool.push({
          type: 'passive', id: owned.id, level: owned.level + 1, name: pas.name,
          desc: `Ур. ${owned.level + 1}: усиление снаряжения`, color: '#9ad',
        });
      }
    }
    if (!pool.length) {
      pool.push({ type: 'heal', id: 'heal', name: 'Кружка браги', desc: '+35 HP', color: '#e07090' });
    }
    return pool.sort(() => Math.random() - 0.5).slice(0, MAX_CHOICES);
  }

  /** Weighted draw without replacement. Uses `weighted` from data.js. */
  _pickWeightedDistinct(pool, n) {
    const items = pool.slice();
    const out = [];
    const count = Math.min(n, items.length);
    while (out.length < count) {
      const pick = weighted(items, items.map((c) => (c.w > 0 ? c.w : 1)));
      out.push(pick);
      items.splice(items.indexOf(pick), 1);
    }
    return out;
  }

  _levelOptions() {
    const p = this.player;
    const pool = [];
    // Cap combined weight of brand-new weapons under one owned upgrade (VS-like).
    const newWeaponGroup = p.weapons.length >= 3 ? 4 : p.weapons.length <= 1 ? 6 : 8;
    let newWeaponIds = [];
    if (p.weapons.length < MAX_WEAPONS) {
      newWeaponIds = Object.keys(WEAPONS).filter((id) => {
        const w = WEAPONS[id];
        return !w.evolved && !p.weapons.find((x) => x.id === id)
          && isWeaponUnlocked(this.meta, id, this.char.id);
      });
    }
    const newWeaponW = newWeaponIds.length
      ? Math.max(0.5, newWeaponGroup / newWeaponIds.length)
      : 0;
    for (const id of Object.keys(WEAPONS)) {
      const w = WEAPONS[id];
      if (w.evolved) continue;
      const owned = p.weapons.find((x) => x.id === id);
      if (owned) {
        const card = this._weaponUpgradeCard(id, owned);
        if (card) {
          card.w = card.type === 'evolve' ? 10 : 12;
          pool.push(card);
        }
      } else if (newWeaponIds.includes(id)) {
        pool.push({
          type: 'weapon', id, level: 1, name: w.name, desc: w.desc, color: weaponColor(id),
          w: newWeaponW,
        });
      }
    }
    for (const id of Object.keys(PASSIVES)) {
      const pas = PASSIVES[id];
      const owned = p.passives.find((x) => x.id === id);
      if (owned) {
        if (owned.level < pas.max) {
          pool.push({
            type: 'passive', id, level: owned.level + 1, name: pas.name,
            desc: `Уровень ${owned.level + 1}`, color: '#9ad', w: 4,
          });
        }
      } else if (p.passives.length < MAX_PASSIVES) {
        pool.push({
          type: 'passive', id, level: 1, name: pas.name, desc: pas.desc, color: '#9ad', w: 2,
        });
      }
    }
    const hpFrac = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    const healT = clamp((hpFrac - 0.4) / 0.3, 0, 1);
    const healW = 4 - healT * 3;
    pool.push({ type: 'heal', id: 'heal', name: 'Кружка браги', desc: '+35 HP', color: '#e07090', w: healW });
    return this._pickWeightedDistinct(pool, MAX_CHOICES);
  }

  pickLevel(opt) {
    const p = this.player;
    if (opt) {
      if (opt.type === 'heal') {
        p.hp = Math.min(p.maxHp, p.hp + 35);
      } else if (opt.type === 'weapon') {
        const owned = p.weapons.find((x) => x.id === opt.id);
        if (owned) owned.level = opt.level;
        else p.weapons.push({ id: opt.id, level: 1, cd: 0 });
      } else if (opt.type === 'evolve') {
        p.weapons = p.weapons.filter((x) => x.id !== opt.from);
        p.weapons.push({ id: opt.id, level: 1, cd: 0 });
        this.fx.push({ kind: 'text', x: p.x, y: p.y - 40, text: 'ЭВОЛЮЦИЯ!', life: 1.4, vy: -30 });
        this.shake = 0.25;
      } else if (opt.type === 'passive') {
        const owned = p.passives.find((x) => x.id === opt.id);
        if (owned) owned.level = opt.level;
        else p.passives.push({ id: opt.id, level: 1 });
        this._applyPassives();
      }
    }
    if (this.pendingLevels > 0) this.pendingLevels = Math.max(0, this.pendingLevels - 1);
    this.vacuumGems();
    p.invuln = Math.max(p.invuln, 1.25);
    this.levelPick = null;
    this.hooks.onHud?.();
    if (this.pendingLevels > 0 && !this.over) {
      this.openLevelUp();
      return;
    }
    this.paused = false;
    this.hooks.onLevelPicked?.();
  }

  _startDefendEvent() {
    const cfg = MAP_EVENTS.defend;
    const p = this.player;
    const a = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * 50;
    this.event = {
      kind: 'defend',
      x: p.x + Math.cos(a) * dist,
      y: p.y + Math.sin(a) * dist,
      r: cfg.radius,
      life: cfg.dur,
      max: cfg.dur,
      inside: 0,
      waveAcc: 0,
      wavesLeft: cfg.waves,
      label: cfg.label,
    };
    this.fx.push({ kind: 'text', x: this.event.x, y: this.event.y - 40, text: cfg.label, life: 2, vy: -18 });
    this.shake = 0.15;
  }

  _startEliteEvent() {
    const ids = ['rytsar', 'znamenosets', 'penodukh', 'metalshchik'];
    const id = ids[(Math.random() * ids.length) | 0];
    const before = this.enemies.length;
    this.spawnEnemy(id);
    const e = this.enemies[this.enemies.length - 1];
    if (!e || this.enemies.length === before) return;
    const mul = MAP_EVENTS.elite.hpMul;
    e.hp *= mul;
    e.maxHp *= mul;
    e.xp = Math.round(e.xp * MAP_EVENTS.elite.xpMul);
    e.r *= 1.35;
    e.elite = true;
    e.speed *= 0.85;
    e.dmg *= 1.35;
    e.name = `Элита: ${e.name}`;
    this.event = {
      kind: 'elite',
      target: e,
      life: 90,
      label: MAP_EVENTS.elite.label,
    };
    this.fx.push({ kind: 'text', x: e.x, y: e.y - 50, text: MAP_EVENTS.elite.label, life: 2.2, vy: -18 });
    this.shake = 0.2;
  }

  _tryStartEvent() {
    if (this.event || this.bossSpawned || this.over) return;
    if (this.time < this.nextEventAt) return;
    if (this.eventIndex % 2 === 0) this._startDefendEvent();
    else this._startEliteEvent();
    this.eventIndex++;
    this.nextEventAt = this.time + MAP_EVENTS.every;
  }

  _updateEvent(dt) {
    const ev = this.event;
    if (!ev) return;
    if (ev.kind === 'elite') {
      if (!ev.target || ev.target.dead) {
        this.pickups.push({ x: this.player.x + 20, y: this.player.y - 10, kind: 'gear_chest', value: 0 });
        this.fx.push({ kind: 'text', x: this.player.x, y: this.player.y - 55, text: 'Элита повержена!', life: 1.6, vy: -22 });
        this.event = null;
      }
      return;
    }
    if (ev.kind === 'defend') {
      ev.life -= dt;
      const p = this.player;
      const inZone = Math.hypot(p.x - ev.x, p.y - ev.y) <= ev.r;
      if (inZone) ev.inside += dt;
      ev.waveAcc += dt;
      if (ev.wavesLeft > 0 && ev.waveAcc >= 4.5) {
        ev.waveAcc = 0;
        ev.wavesLeft--;
        for (let i = 0; i < MAP_EVENTS.defend.pack; i++) {
          // spawnEnemy already places off-screen — do not teleport into the zone/FOV
          this.spawnEnemy();
        }
      }
      if (ev.life <= 0) {
        const ok = ev.inside >= ev.max * 0.55;
        if (ok) {
          this.pickups.push({ x: ev.x, y: ev.y, kind: 'gear_chest', value: 0 });
          this.fx.push({ kind: 'text', x: ev.x, y: ev.y - 40, text: 'Зона удержана!', life: 1.8, vy: -20 });
          this.vfx.ringBurst(ev.x, ev.y, '#e8c878');
        } else {
          this.fx.push({ kind: 'text', x: ev.x, y: ev.y - 40, text: 'Зона потеряна…', life: 1.6, vy: -18 });
        }
        this.event = null;
      }
    }
  }

  _drawEvent(ctx) {
    const ev = this.event;
    if (!ev || ev.kind !== 'defend') return;
    const x = ev.x - this.cam.x;
    const y = ev.y - this.cam.y;
    const t = performance.now() / 1000;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.strokeStyle = `rgba(240,212,138,${0.45 + Math.sin(t * 4) * 0.2})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, ev.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(232,200,120,0.08)';
    ctx.beginPath();
    ctx.arc(x, y, ev.r, 0, Math.PI * 2);
    ctx.fill();
    // бочка-маркер
    ctx.fillStyle = '#8a5428';
    ctx.fillRect(x - 8, y - 10, 16, 14);
    ctx.fillStyle = '#f0d080';
    ctx.fillRect(x - 8, y - 4, 16, 3);
    const pct = Math.min(1, ev.inside / (ev.max * 0.55));
    ctx.fillStyle = '#0c0e12';
    ctx.fillRect(x - 28, y + ev.r + 8, 56, 6);
    ctx.fillStyle = pct >= 1 ? '#70d070' : '#e8c878';
    ctx.fillRect(x - 28, y + ev.r + 8, 56 * pct, 6);
    ctx.fillStyle = '#fff';
    ctx.font = '700 12px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${ev.label} ${Math.ceil(ev.life)}с`, x, y - ev.r - 10);
    ctx.restore();
  }

  _applyPassives() {
    const p = this.player;
    const b = this.bonuses;
    p.might = b.might;
    p.area = 1 + (b.area || 0);
    p.cooldown = b.cooldown || 1;
    p.amount = 0;
    p.speed = this.char.speed * b.speed;
    p.baseSpeed = p.speed;
    p.magnet = 100 + (b.magnet || 0);
    p.regen = b.regen || 0;
    p.luck = b.luck || 1;
    p.greed = b.greed || 1;
    p.armor = b.armor || 0;
    p.growth = 1.05;
    let maxHpBonus = b.hp;
    for (const pas of p.passives) {
      const d = pDef(pas.id);
      if (!d) continue;
      const v = d.per * pas.level;
      if (d.key === 'might') p.might += v;
      if (d.key === 'area') p.area += v;
      if (d.key === 'cooldown') p.cooldown = Math.max(0.45, p.cooldown - v);
      if (d.key === 'amount') p.amount += Math.floor(v + 0.001);
      if (d.key === 'speed') p.speed = p.baseSpeed * (1 + v);
      if (d.key === 'magnet') p.magnet += v;
      if (d.key === 'maxhp') maxHpBonus += v;
      if (d.key === 'recovery') p.regen += v;
      if (d.key === 'armor') p.armor += v;
      if (d.key === 'growth') p.growth += v;
    }
    const target = this.char.hp + maxHpBonus;
    if (target > p.maxHp) {
      p.hp += target - p.maxHp;
      p.maxHp = target;
    }
  }

  _wavePack() {
    for (const w of WAVES) {
      if (this.time < w.until) return w;
    }
    return WAVES[WAVES.length - 1];
  }

  /** World point just outside the player's view (never in FOV). */
  _spawnOutsideView(bodyR = 20, extraPad = 0) {
    const p = this.player;
    // Use player-centered view so spawn stays correct even if cam lags a frame.
    const vx0 = p.x - W / 2;
    const vy0 = p.y - H / 2;
    // Radius + lead so fast movers / large sprites don't pop into frame.
    const pad = Math.max(160, bodyR * 2.5 + 120) + extraPad;
    for (let attempt = 0; attempt < 12; attempt++) {
      const side = (Math.random() * 4) | 0;
      let x; let y;
      if (side === 0) {
        x = vx0 - pad - rand(0, 80);
        y = vy0 + rand(-pad * 0.35, H + pad * 0.35);
      } else if (side === 1) {
        x = vx0 + W + pad + rand(0, 80);
        y = vy0 + rand(-pad * 0.35, H + pad * 0.35);
      } else if (side === 2) {
        x = vx0 + rand(-pad * 0.35, W + pad * 0.35);
        y = vy0 - pad - rand(0, 80);
      } else {
        x = vx0 + rand(-pad * 0.35, W + pad * 0.35);
        y = vy0 + H + pad + rand(0, 80);
      }
      // Reject if still inside expanded view rect (corner / float error).
      if (x >= vx0 - bodyR && x <= vx0 + W + bodyR && y >= vy0 - bodyR && y <= vy0 + H + bodyR) {
        continue;
      }
      return { x, y };
    }
    // Fallback: far left of player.
    return { x: p.x - W / 2 - pad - 40, y: p.y };
  }

  spawnEnemy(forcedId) {
    const wave = this._wavePack();
    const id = forcedId || weighted(wave.pack, wave.w);
    const def = eDef(id);
    const diff = difficultyAt(this.time, this.map.difficulty);
    const { x, y } = this._spawnOutsideView(def.r || 16);
    this.enemies.push({
      id: def.id, name: def.name,
      x, y,
      hp: def.hp * diff.hp,
      maxHp: def.hp * diff.hp,
      speed: def.speed * diff.speed * (0.9 + Math.random() * 0.2),
      dmg: def.dmg * diff.dmg,
      xp: def.xp,
      r: def.r,
      color: def.color,
      charge: !!def.charge,
      explode: def.explode || 0,
      shoot: def.shoot || 0,
      buff: !!def.buff,
      boss: !!def.boss,
      hitFlash: 0,
      chargeT: 0,
      chargeDir: null,
      shootCd: rand(0.4, 1.2),
      slowT: 0,
      buffMul: 1,
      exploded: false,
      dead: false,
    });
  }

  spawnBoss() {
    const def = ENEMIES.khmeldorf;
    const diff = difficultyAt(this.time, this.map.difficulty);
    const { x, y } = this._spawnOutsideView(def.r, 80);
    this.enemies.push({
      id: def.id, name: def.name,
      x, y,
      hp: def.hp * diff.hp, maxHp: def.hp * diff.hp,
      speed: def.speed * diff.speed, dmg: def.dmg * diff.dmg,
      xp: def.xp, r: def.r, color: def.color,
      charge: true, explode: 0, shoot: def.shoot, buff: false, boss: true,
      hitFlash: 0, chargeT: 0, chargeDir: null, shootCd: 0.8, slowT: 0,
      buffMul: 1, exploded: false, dead: false, phase: 1,
    });
    this.bossPhase = 1;
    this.shake = 0.5;
    this.fx.push({ kind: 'text', x: this.player.x, y: this.player.y - 56, text: 'БАРОН ХМЕЛЬДОРФ!', life: 2.4, vy: -18 });
    sfx.chest();
  }

  spawnReaper() {
    if (this.reaperSpawned) return;
    this.reaperSpawned = true;
    const def = ENEMIES.zhnec;
    const { x, y } = this._spawnOutsideView(def.r, 100);
    this.enemies.push({
      id: def.id, name: def.name,
      x, y,
      hp: def.hp, maxHp: def.hp,
      speed: def.speed, dmg: def.dmg, xp: 0, r: def.r, color: def.color,
      charge: false, explode: 0, shoot: 0, buff: false, boss: false, reaper: true,
      hitFlash: 0, chargeT: 0, chargeDir: null, shootCd: 0, slowT: 0,
      buffMul: 1, exploded: false, dead: false, fx: 0, fy: 0,
    });
    this.fx.push({ kind: 'text', x: this.player.x, y: this.player.y - 70, text: 'ТРЕЗВЫЙ ЖНЕЦ!', life: 2.5, vy: -22 });
    this.shake = 0.45;
    sfx.chest();
  }

  spawnFoamPuddle(x, y, r = 48, life = 2.2) {
    this.zones.push({
      kind: 'foam', x, y, r: r * (this.player.area || 1),
      life, max: life, slow: 1.6,
    });
    this.vfx.foam(x, y, 8);
  }

  _updateZones(dt) {
    for (const z of this.zones) z.life -= dt;
    this.zones = this.zones.filter((z) => z.life > 0);
  }

  _drawZones(ctx) {
    for (const z of this.zones) {
      if (z.kind !== 'foam') continue;
      const x = z.x - this.cam.x;
      const y = z.y - this.cam.y;
      const a = Math.max(0.15, z.life / z.max);
      ctx.save();
      ctx.globalAlpha = 0.35 * a;
      ctx.fillStyle = '#e8e0c0';
      ctx.beginPath();
      ctx.ellipse(x, y, z.r, z.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.55 * a;
      ctx.fillStyle = '#fff8e8';
      ctx.beginPath();
      ctx.ellipse(x - z.r * 0.15, y - z.r * 0.08, z.r * 0.45, z.r * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawIceRing(ctx) {
    if (this.time <= 420) return;
    const steps = 64;
    ctx.save();
    ctx.strokeStyle = 'rgba(120, 180, 220, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const wx = Math.cos(a) * this.iceRadius;
      const wy = Math.sin(a) * this.iceRadius;
      const sx = wx - this.cam.x;
      const sy = wy - this.cam.y;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(8, 20, 32, 0.22)';
    // dark outside approx via full-screen vignette when player near edge
    const pd = Math.hypot(this.player.x, this.player.y);
    if (pd > this.iceRadius * 0.82) {
      ctx.fillStyle = `rgba(10, 24, 40,${Math.min(0.45, (pd / this.iceRadius - 0.82) * 2)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  hurtEnemy(e, dmg, crit = false, slow = 0) {
    const mul = e.buffMul || 1;
    const taken = dmg / mul;
    e.hp -= taken;
    e.hitFlash = 0.1;
    if (slow) e.slowT = Math.max(e.slowT, slow);
    this.fx.push({
      kind: 'dmg', x: e.x + rand(-6, 6), y: e.y - 10, text: String(Math.round(taken)),
      life: 0.55, vy: -42, crit,
    });
    this.vfx.impact(e.x, e.y - 4, crit ? '#ffe080' : e.color);
    if (crit) this.vfx.sparks(e.x, e.y, '#ffe080');
    sfx.hit();
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    this.killCount++;
    this.killStreak++;
    this.streakTimer = 2.2;
    this.gems.push({ x: e.x, y: e.y, v: e.xp + (this.killStreak > 8 ? 1 : 0), big: e.boss || e.xp >= 5 });
    if (e.boss || e.buff || e.charge) this.shake = Math.max(this.shake, 0.22);

    if (Math.random() < 0.12 * this.player.luck) {
      this.pickups.push({
        x: e.x + rand(-8, 8), y: e.y + rand(-8, 8),
        kind: 'coin', value: Math.max(1, Math.floor(1 * this.player.greed + Math.random())),
      });
    }
    if (e.boss || Math.random() < 0.025 * this.player.luck) {
      this.pickups.push({ x: e.x, y: e.y - 16, kind: 'chest', value: 0 });
    }
    if (e.explode && !e.exploded) {
      e.exploded = true;
      this.fx.push({ kind: 'ring', x: e.x, y: e.y, r: 10, life: 0.35, vr: e.explode * 1.5 });
      this.vfx.ringBurst(e.x, e.y, '#e8e0c0');
      this.vfx.foam(e.x, e.y, 18);
      if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < e.explode && this.player.invuln <= 0) {
        this.hurtPlayer(e.dmg * 1.3);
      }
      for (const o of this.enemies) {
        if (o.dead || o === e) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) < e.explode * 0.55) this.hurtEnemy(o, e.dmg);
      }
    }
    if (e.boss) {
      this.bossKilled = true;
      this.victoryT = 2.8;
      this.vacuumGems();
      this.fx.push({ kind: 'ring', x: e.x, y: e.y, r: 20, life: 1.2, vr: 180 });
      this.fx.push({ kind: 'text', x: e.x, y: e.y - 40, text: 'В пивную пучину!', life: 2, vy: -20 });
      this.shake = 0.6;
    }
  }

  hurtPlayer(dmg) {
    const p = this.player;
    if (p.invuln > 0 || p.dashT > 0 || p.berserkT > 0) return;
    const resist = clamp(p.armor, 0, 0.7);
    const taken = Math.max(1, dmg * (1 - resist));
    p.hp -= taken;
    p.invuln = 0.85;
    this.hitFlash = 0.35;
    this.killStreak = 0;
    sfx.hurt();
    this.fx.push({ kind: 'text', x: p.x, y: p.y - 28, text: `-${Math.round(taken)}`, life: 0.65, vy: -28 });
    // оттолкнуть ближайших врагов
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x; const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 70) {
        e.x += (dx / d) * 48;
        e.y += (dy / d) * 48;
      }
    }
    if (p.hp <= 0) {
      if (p.revivesLeft > 0) {
        p.revivesLeft--;
        p.hp = Math.max(1, Math.floor(p.maxHp * 0.35));
        p.invuln = Math.max(p.invuln, 2.2);
        this.hitFlash = 0.5;
        this.vfx.berserkWave(p.x, p.y);
        this.fx.push({ kind: 'text', x: p.x, y: p.y - 48, text: 'ПОХМЕЛЬНЫЙ ЩИТ!', life: 1.5, vy: -30 });
        this.shake = 0.35;
        return;
      }
      p.hp = 0;
      this.endRun(false);
    }
  }

  endRun(won) {
    this.won = won;
    this.over = true;
    this.paused = true;
    this.hooks.onOver?.(this.result());
  }

  fireWeapons(dt) {
    const p = this.player;
    for (const slot of p.weapons) {
      const st = weaponLevelStats(slot.id, slot.level);
      if (st.style === 'orbit') {
        this._ensureOrbits(slot, st);
        continue;
      }
      slot.cd -= dt;
      if (slot.cd > 0) continue;
      slot.cd = st.cd * p.cooldown;
      this._fireOne(slot.id, st);
      p.attackT = Math.max(p.attackT, st.style === 'arc' ? 0.35 : 0.22);
      sfx.cast();
    }
  }

  _ensureOrbits(slot, st) {
    const need = st.amount + this.player.amount;
    let list = this.orbits.filter((o) => o.wid === slot.id);
    while (list.length < need) {
      const o = {
        wid: slot.id, a: Math.random() * Math.PI * 2,
        r: 56 * this.player.area, dmg: st.dmg * this.player.might,
        color: st.color, hitCd: new Map(),
      };
      this.orbits.push(o);
      list.push(o);
    }
    while (list.length > need) {
      const drop = list.pop();
      this.orbits = this.orbits.filter((o) => o !== drop);
    }
    for (const o of list) {
      o.dmg = st.dmg * this.player.might;
      o.r = 56 * this.player.area * (1 + (slot.level - 1) * 0.04);
    }
  }

  _nearestEnemy(from = this.player) {
    let best = null; let bd = 1e9;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  _fireOne(id, st) {
    const p = this.player;
    const amt = st.amount + p.amount;
    const dmg = st.dmg * p.might;
    const target = this._nearestEnemy();
    const aim = target
      ? ang(target.x - p.x, target.y - p.y)
      : ang(this.pointer.x + this.cam.x - p.x, this.pointer.y + this.cam.y - p.y);

    if (st.style === 'arc') {
      const rad = (typeof st.area === 'number' ? st.area : 95) * p.area;
      for (let i = 0; i < Math.max(1, amt); i++) {
        const a = aim + (i - (Math.max(1, amt) - 1) / 2) * 0.35;
        this.projectiles.push({
          x: p.x, y: p.y, a, life: 0.22, r: rad, dmg, color: st.color,
          kind: 'arc', hit: new Set(), pierce: 99, slow: st.slow, shape: 'mug', age: 0,
        });
        this.vfx.slash(p.x, p.y, a - 0.72, a + 0.72, rad, st.color);
        this.vfx.foam(p.x + Math.cos(a) * rad * 0.55, p.y + Math.sin(a) * rad * 0.55, 10);
      }
      if (id === 'nakat') {
        this.fx.push({ kind: 'ring', x: p.x, y: p.y, r: 20, life: 0.3, vr: 160 });
        this.vfx.ringBurst(p.x, p.y, st.color);
        this.vfx.foam(p.x, p.y, 16);
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < 110 * p.area) this.hurtEnemy(e, dmg * 0.4, false, 0.4);
        }
      }
    } else if (st.style === 'orbit_throw') {
      for (let i = 0; i < amt; i++) {
        const a = aim - 0.25 + i * 0.18;
        this.projectiles.push({
          x: p.x, y: p.y - 8,
          vx: Math.cos(a) * 250, vy: Math.sin(a) * 250 - 200,
          life: 1.25, r: 14 * p.area, dmg, color: st.color,
          kind: 'bolt', hit: new Set(), pierce: 3 + Math.floor(amt), g: 480,
          explode: id === 'taran' ? 50 * p.area : 0,
          shape: 'barrel', vis: 'barrel', age: 0,
        });
      }
      this.vfx.burst(p.x, p.y - 8, { n: 6, color: '#8a6030', color2: '#c0a050', spd: 80, life: 0.3 });
    } else if (st.style === 'shot') {
      const spd = id === 'serp' || id === 'zhatva' ? 500 : id === 'pena' ? 280 : 340;
      const shape = id === 'pena' ? 'foam'
        : (id === 'zhiguli' || id === 'zavod') ? 'bottle'
          : (id === 'serp' || id === 'zhatva') ? 'serp'
            : 'bolt';
      const slow = id === 'pena' ? 1.4 : (st.slow || 0);
      for (let i = 0; i < amt; i++) {
        const a = aim + (i - (amt - 1) / 2) * (id === 'zhatva' ? 0.22 : 0.1);
        this.projectiles.push({
          x: p.x, y: p.y,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          life: 1.1, r: (id === 'pena' ? 16 : 8) * p.area, dmg, color: st.color,
          kind: 'bolt', hit: new Set(),
          pierce: id === 'serp' || id === 'zhatva' ? 3 : 1 + Math.floor(amt / 3),
          explode: id === 'zhiguli' || id === 'zavod' ? 32 * p.area : 0,
          slow, shape, vis: shape, age: 0,
          puddle: id === 'pena' || id === 'zhiguli' || id === 'zavod',
        });
      }
      if (id === 'pena') this.vfx.foam(p.x + Math.cos(aim) * 20, p.y + Math.sin(aim) * 20, 14);
    } else if (st.style === 'nova') {
      const n = Math.max(6, amt);
      this.vfx.ringBurst(p.x, p.y, st.color);
      this.vfx.foam(p.x, p.y, 12);
      this.spawnFoamPuddle(p.x, p.y, 70 * p.area, 2.5);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + this.time;
        this.projectiles.push({
          x: p.x, y: p.y,
          vx: Math.cos(a) * 220, vy: Math.sin(a) * 220,
          life: 0.85, r: 12 * p.area, dmg: dmg * 0.85, color: st.color,
          kind: 'bolt', hit: new Set(), pierce: 3, slow: 0.45, shape: 'foam', age: 0, puddle: true,
        });
      }
    } else if (st.style === 'chain') {
      let cur = this._nearestEnemy();
      let prev = p;
      const hit = new Set();
      for (let i = 0; i < amt + 1 && cur; i++) {
        hit.add(cur);
        const crit = Math.random() < 0.1 * p.luck;
        this.hurtEnemy(cur, dmg * (crit ? 1.75 : 1), crit);
        this.fx.push({ kind: 'arc', x: cur.x, y: cur.y, r: 22, a0: 0, a1: Math.PI * 2, life: 0.12 });
        this.vfx.chainBolt(prev.x, prev.y, cur.x, cur.y, st.color);
        prev = cur;
        let next = null; let bd = 170 * p.area;
        for (const e of this.enemies) {
          if (e.dead || hit.has(e)) continue;
          const d = Math.hypot(e.x - cur.x, e.y - cur.y);
          if (d < bd) { bd = d; next = e; }
        }
        cur = next;
      }
    } else {
      for (let i = 0; i < amt; i++) {
        const a = aim + (i - (amt - 1) / 2) * 0.12;
        this.projectiles.push({
          x: p.x, y: p.y,
          vx: Math.cos(a) * 320, vy: Math.sin(a) * 320,
          life: 1, r: 10, dmg, color: st.color,
          kind: 'bolt', hit: new Set(), pierce: 2, shape: 'hop', age: 0,
        });
      }
    }
  }

  update(dt) {
    if (this.over) return;
    if (this.levelPick || this.paused) return;
    this.time += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.vacuumT > 0) {
      this.vacuumT = Math.max(0, this.vacuumT - dt);
      if (this.vacuumT <= 0) this._applyPassives();
    }
    if (this.victoryT > 0) {
      this.victoryT -= dt;
      if (this.victoryT <= 0 && !this.levelPick && this.pendingLevels <= 0) {
        this.endRun(true);
        return;
      }
    }
    if (!this.timeUp && this.time >= TIME_LIMIT) {
      this.timeUp = true;
      if (this.bossKilled) {
        this.endRun(true);
        return;
      }
      this.spawnReaper();
    }
    if (this.streakTimer > 0) {
      this.streakTimer -= dt;
      if (this.streakTimer <= 0) this.killStreak = 0;
    }

    const p = this.player;
    if (p.dashCd > 0) p.dashCd = Math.max(0, p.dashCd - dt);
    if (p.berserkCd > 0) p.berserkCd = Math.max(0, p.berserkCd - dt);
    if (p.berserkT > 0) p.berserkT -= dt;
    if (p.attackT > 0) p.attackT -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

    // ice slip
    p.slip = 0;
    for (const h of this.hazards) {
      const d = Math.hypot(h.x - p.x, h.y - p.y);
      if (d < h.r) {
        if (h.kind === 'slip') p.slip = 0.18;
        if (h.kind === 'polynya') {
          p._polyAcc = (p._polyAcc || 0) + dt;
          if (p._polyAcc > 0.35) {
            p._polyAcc = 0;
            this.hurtPlayer(h.dmg || 8);
          }
        }
      }
    }

    let mx = 0; let my = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) my -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown) my += 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) mx -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) mx += 1;
    const ml = len(mx, my);
    p.moving = ml > 0.05;
    const spd = p.speed * (1 + p.slip);
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.x += p.dashDir.x * p.speed * DASH.mul * dt;
      p.y += p.dashDir.y * p.speed * DASH.mul * dt;
    } else if (p.moving) {
      const tx = (mx / ml) * spd;
      const ty = (my / ml) * spd;
      // инерция на льду
      p.vx += (tx - p.vx) * (p.slip ? 0.08 : 0.35);
      p.vy += (ty - p.vy) * (p.slip ? 0.08 : 0.35);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (mx) p.facing = mx < 0 ? -1 : 1;
    } else {
      p.vx *= p.slip ? 0.985 : 0.85;
      p.vy *= p.slip ? 0.985 : 0.85;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    resolveSolidCollision(p, this.solids);

    // Сжатие арены после 7-й минуты
    if (this.time > 420) {
      const tShrink = Math.min(1, (this.time - 420) / 180);
      this.iceRadius = 5200 - tShrink * 3800;
      const dist = Math.hypot(p.x, p.y);
      if (dist > this.iceRadius) {
        const pull = (dist - this.iceRadius) * 1.8 * dt;
        p.x -= (p.x / dist) * pull;
        p.y -= (p.y / dist) * pull;
        if (Math.random() < dt * 2) this.hurtPlayer(4);
      }
    }

    // Черта Семёна: пенный след
    if (this.char.trait === 'foam_trail' && p.moving) {
      this.trailAcc = (this.trailAcc || 0) + dt;
      if (this.trailAcc > 0.35) {
        this.trailAcc = 0;
        this.spawnFoamPuddle(p.x, p.y, 36, 1.6);
      }
    }

    this.cam.x = Math.round(p.x - W / 2);
    this.cam.y = Math.round(p.y - H / 2);

    this._updateZones(dt);

    const diff = difficultyAt(this.time, this.map.difficulty);
    this.spawnAcc += dt;
    const enemyCap = this.time > 360 ? 110 : 140;
    while (this.spawnAcc >= diff.every && this.enemies.length < enemyCap) {
      this.spawnAcc -= diff.every;
      for (let i = 0; i < diff.pack; i++) this.spawnEnemy();
    }

    for (const sp of SPECIALS) {
      if (this.time >= sp.at && !this.specialDone.has(sp.at)) {
        this.specialDone.add(sp.at);
        for (let i = 0; i < sp.n; i++) this.spawnEnemy(sp.enemy);
        this.fx.push({ kind: 'text', x: p.x, y: p.y - 60, text: sp.label || 'ВОЛНА!', life: 1.3, vy: -25 });
        this.shake = 0.2;
      }
    }

    this._tryStartEvent();
    this._updateEvent(dt);

    if (!this.bossSpawned && this.time >= (this.map.bossAt ?? TIME_LIMIT - 30)) {
      this.bossSpawned = true;
      this.spawnBoss();
    }

    if (Math.random() < dt * 0.04) {
      this.pickups.push({
        x: p.x + rand(-420, 420),
        y: p.y + rand(-320, 320),
        kind: Math.random() < 0.65 ? 'coin' : 'potion',
        value: Math.random() < 0.65 ? Math.max(1, Math.floor(2 * p.greed + Math.random())) : 28,
      });
    }

    this.fireWeapons(dt);
    this._updateOrbits(dt);
    this._updateProjectiles(dt);
    this._updateEnemies(dt);
    this._updateGems(dt);
    this._updatePickups(dt);
    this._updateFx(dt);
    this.vfx.update(dt);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.hooks.onHud?.();
  }

  _updateOrbits(dt) {
    const p = this.player;
    const n = this.orbits.length || 1;
    this.orbits.forEach((o, i) => {
      o.a += dt * 2.5;
      const a = o.a + (Math.PI * 2 * i) / n;
      o.x = p.x + Math.cos(a) * o.r;
      o.y = p.y + Math.sin(a) * o.r;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - o.x, e.y - o.y) < 16 + e.r) {
          const last = o.hitCd.get(e) || 0;
          if (this.time - last > 0.25) {
            o.hitCd.set(e, this.time);
            this.hurtEnemy(e, o.dmg);
          }
        }
      }
    });
  }

  _updateProjectiles(dt) {
    for (const pr of this.projectiles) {
      pr.life -= dt;
      pr.age = (pr.age || 0) + dt;
      if (pr.kind === 'arc') {
        for (const e of this.enemies) {
          if (e.dead || pr.hit.has(e)) continue;
          const dx = e.x - pr.x; const dy = e.y - pr.y;
          const d = Math.hypot(dx, dy);
          if (d > pr.r + e.r) continue;
          const da = Math.abs(Math.atan2(dy, dx) - pr.a);
          if (Math.min(da, Math.PI * 2 - da) < 0.75) {
            pr.hit.add(e);
            const crit = Math.random() < 0.1 * this.player.luck;
            this.hurtEnemy(e, pr.dmg * (crit ? 1.85 : 1), crit, pr.slow);
          }
        }
      } else if (pr.kind === 'enemy') {
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        if (Math.hypot(pr.x - this.player.x, pr.y - this.player.y) < pr.r + 14) {
          this.hurtPlayer(pr.dmg);
          pr.life = 0;
        }
      } else {
        if (pr.g) pr.vy += pr.g * dt;
        pr.x += (pr.vx || 0) * dt;
        pr.y += (pr.vy || 0) * dt;
        if (pr.kind !== 'enemy' && Math.random() < 0.45) {
          this.vfx.trail(pr.x, pr.y, pr.color || '#fff', pr.vx, pr.vy);
        }
        for (const e of this.enemies) {
          if (e.dead || pr.hit.has(e)) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) < pr.r + e.r) {
            pr.hit.add(e);
            const crit = Math.random() < 0.1 * this.player.luck;
            this.hurtEnemy(e, pr.dmg * (crit ? 1.85 : 1), crit, pr.slow);
            pr.pierce = (pr.pierce || 1) - 1;
            if (pr.puddle || pr.shape === 'foam') this.spawnFoamPuddle(pr.x, pr.y, pr.r * 2.2, 2.4);
            if (pr.explode) {
              this.fx.push({ kind: 'ring', x: pr.x, y: pr.y, r: 8, life: 0.28, vr: pr.explode * 2 });
              this.vfx.ringBurst(pr.x, pr.y, pr.color);
              this.vfx.foam(pr.x, pr.y, 10);
              this.spawnFoamPuddle(pr.x, pr.y, pr.explode * 0.7, 2.8);
              for (const e2 of this.enemies) {
                if (e2.dead || e2 === e) continue;
                if (Math.hypot(e2.x - pr.x, e2.y - pr.y) < pr.explode) this.hurtEnemy(e2, pr.dmg * 0.55);
              }
            }
            if (pr.pierce <= 0) { pr.life = 0; break; }
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  _updateEnemies(dt) {
    const p = this.player;
    // знаменосцы баффают
    for (const e of this.enemies) {
      e.buffMul = 1;
    }
    for (const z of this.enemies) {
      if (z.dead || !z.buff) continue;
      for (const e of this.enemies) {
        if (e.dead || e === z) continue;
        if (Math.hypot(e.x - z.x, e.y - z.y) < 110) e.buffMul = 1.35;
      }
    }

    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.slowT > 0) e.slowT -= dt;
      let slowMul = e.slowT > 0 ? 0.5 : 1;
      // лужи пены
      for (const z of this.zones) {
        if (z.kind !== 'foam') continue;
        if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) {
          slowMul *= 0.45;
          e.slowT = Math.max(e.slowT, 0.2);
        }
      }
      // сжатие арены
      if (this.time > 420) {
        const ed = Math.hypot(e.x, e.y);
        if (ed > this.iceRadius) {
          e.x -= (e.x / ed) * 120 * dt;
          e.y -= (e.y / ed) * 120 * dt;
        }
      }
      // фазы барона
      if (e.boss && !e.dead) {
        const frac = e.hp / e.maxHp;
        if (frac < 0.66 && (e.phase || 1) < 2) {
          e.phase = 2; this.bossPhase = 2;
          e.shoot = 1.1; e.speed *= 1.12;
          for (let i = 0; i < 6; i++) this.spawnEnemy('rytsar');
          this.fx.push({ kind: 'text', x: e.x, y: e.y - 60, text: 'ФАЗА 2: ЗНАМЁНА!', life: 2, vy: -20 });
          this.spawnFoamPuddle(e.x, e.y, 90, 4);
        } else if (frac < 0.33 && (e.phase || 1) < 3) {
          e.phase = 3; this.bossPhase = 3;
          e.shoot = 0.85; e.charge = true; e.speed *= 1.15;
          for (let i = 0; i < 8; i++) this.spawnEnemy('oruzhenosets');
          this.fx.push({ kind: 'text', x: e.x, y: e.y - 60, text: 'ФАЗА 3: В УПОР!', life: 2, vy: -20 });
          this.shake = 0.4;
        }
      }
      const dx = p.x - e.x; const dy = p.y - e.y;
      const d = len(dx, dy);
      const ox = e.x;
      const oy = e.y;

      if (e.reaper) {
        e.x += (dx / d) * e.speed * dt;
        e.y += (dy / d) * e.speed * dt;
        resolveSolidCollision(e, this.solids);
        e.fx = e.x - ox; e.fy = e.y - oy;
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 16) {
          // Don't strip shields during i-frames; on a real hit burn revives then kill.
          if (p.invuln <= 0) {
            p.revivesLeft = 0;
            this.hurtPlayer(999);
          }
        }
        continue;
      }

      if (e.charge) {
        e.chargeT -= dt;
        if (e.chargeT <= 0 && d < 290) {
          e.chargeT = e.boss ? 1.8 : 2.1;
          e.chargeDir = { x: dx / d, y: dy / d };
        }
        if (e.chargeT > 1.25 && e.chargeDir) {
          e.x += e.chargeDir.x * e.speed * (e.boss ? 3.4 : 3.1) * slowMul * dt;
          e.y += e.chargeDir.y * e.speed * (e.boss ? 3.4 : 3.1) * slowMul * dt;
        } else {
          e.x += (dx / d) * e.speed * 0.55 * slowMul * dt;
          e.y += (dy / d) * e.speed * 0.55 * slowMul * dt;
        }
      } else if (e.shoot) {
        if (d > 190) {
          e.x += (dx / d) * e.speed * slowMul * dt;
          e.y += (dy / d) * e.speed * slowMul * dt;
        } else if (d < 150) {
          e.x -= (dx / d) * e.speed * slowMul * dt;
          e.y -= (dy / d) * e.speed * slowMul * dt;
        }
      } else {
        e.x += (dx / d) * e.speed * slowMul * dt;
        e.y += (dy / d) * e.speed * slowMul * dt;
      }
      // Shoot independently of charge (boss has both).
      if (e.shoot) {
        e.shootCd -= dt;
        if (e.shootCd <= 0) {
          e.shootCd = e.shoot;
          const n = e.boss ? 5 : 1;
          for (let i = 0; i < n; i++) {
            const a = Math.atan2(dy, dx) + (i - (n - 1) / 2) * 0.18;
            this.projectiles.push({
              x: e.x, y: e.y,
              vx: Math.cos(a) * (e.boss ? 260 : 230),
              vy: Math.sin(a) * (e.boss ? 260 : 230),
              life: 2.2, r: 7, dmg: e.dmg, color: '#70a0c8',
              kind: 'enemy', age: 0,
            });
          }
        }
      }
      resolveSolidCollision(e, this.solids);
      e.fx = e.x - ox;
      e.fy = e.y - oy;

      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 14) {
        this.hurtPlayer(e.dmg);
        const L = len(e.x - p.x, e.y - p.y);
        e.x += ((e.x - p.x) / L) * 36;
        e.y += ((e.y - p.y) / L) * 36;
      }
    }
  }

  _updateGems(dt) {
    const p = this.player;
    const vacuum = this.vacuumT > 0;
    const magnet = vacuum ? 9999 : p.magnet;
    const pull = vacuum ? 920 : 360;
    for (const g of this.gems) {
      const dx = p.x - g.x; const dy = p.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d < magnet) {
        g.x += (dx / (d || 1)) * pull * dt;
        g.y += (dy / (d || 1)) * pull * dt;
      }
      if (d < 22) {
        g.dead = true;
        this.addXp(g.v);
        sfx.pickup();
      }
    }
    this.gems = this.gems.filter((g) => !g.dead);
  }

  _updatePickups() {
    const p = this.player;
    for (const it of this.pickups) {
      if (Math.hypot(it.x - p.x, it.y - p.y) < 22) {
        it.dead = true;
        if (it.kind === 'coin') {
          this.coinsRun += it.value;
          sfx.pickup();
        } else if (it.kind === 'potion') {
          p.hp = Math.min(p.maxHp, p.hp + it.value);
          sfx.pickup();
        } else if (it.kind === 'chest') {
          sfx.chest();
          this.pendingLevels++;
          this.openLevelUp();
        } else if (it.kind === 'gear_chest') {
          this.openGearChest();
        }
      }
    }
    this.pickups = this.pickups.filter((i) => !i.dead);
  }

  _updateFx(dt) {
    for (const f of this.fx) {
      f.life -= dt;
      if (f.vy) f.y += f.vy * dt;
      if (f.vr) f.r += f.vr * dt;
    }
    this.fx = this.fx.filter((f) => f.life > 0);
  }

  draw() {
    const ctx = this.ctx;
    const t = performance.now() / 1000;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * 12 * this.shake, (Math.random() - 0.5) * 12 * this.shake);
    }
    ctx.clearRect(-20, -20, W + 40, H + 40);
    drawWorld(ctx, this.cam, this.map, t, this.hazards, this.solids);
    this._drawZones(ctx);
    this._drawIceRing(ctx);
    this._drawEvent(ctx);
    for (const g of this.gems) drawGem(ctx, g, this.cam);
    for (const it of this.pickups) drawPickup(ctx, it, this.cam, t);
    for (const e of this.enemies) if (!e.dead) drawEnemy(ctx, e, this.cam, t);
    for (const o of this.orbits) {
      drawProj(ctx, { x: o.x, y: o.y, color: o.color, shape: 'hop', vx: 1, vy: 0, age: t }, this.cam, t);
    }
    for (const pr of this.projectiles) {
      drawProj(ctx, pr, this.cam, t);
    }
    this.vfx.draw(ctx, this.cam);
    const heroAlpha = this.player.invuln > 0 && Math.floor(t * 14) % 2 === 0 ? 0.45 : 1;
    ctx.globalAlpha = heroAlpha;
    drawHero(
      ctx, this.char,
      this.player.x - this.cam.x, this.player.y - this.cam.y,
      this.player.facing, this.player.moving, t,
      this.player.dashT > 0, this.player.berserkT > 0,
      this.player.hp, this.player.maxHp,
    );
    ctx.globalAlpha = 1;
    for (const f of this.fx) drawFx(ctx, f, this.cam);

    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(120,16,24,${0.18 + this.hitFlash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.killStreak >= 5) {
      ctx.fillStyle = 'rgba(226,179,69,.85)';
      ctx.font = '700 13px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Серия ×${this.killStreak}`, W / 2, 36);
    }

    if (this.paused && !this.levelPick && !this.over) {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = '800 28px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ПАУЗА', W / 2, 88);
      ctx.font = '700 14px Manrope, sans-serif';
      ctx.fillText('Esc — продолжить', W / 2, 126);
    }
    ctx.restore();
  }

  hud() {
    const p = this.player;
    const left = Math.max(0, TIME_LIMIT - this.time);
    const m = Math.floor(left / 60);
    const s = Math.floor(left % 60).toString().padStart(2, '0');
    return {
      name: this.char.name,
      map: this.map.name,
      hp: p.hp / p.maxHp,
      hpText: `${Math.ceil(p.hp)}/${p.maxHp}`,
      xp: p.xp / p.xpNeed,
      level: p.level,
      pending: this.pendingLevels,
      time: `${m}:${s}`,
      kills: this.killCount,
      streak: this.killStreak,
      dash: 1 - p.dashCd / DASH.cd,
      dashReady: p.dashCd <= 0,
      berserk: p.hasBerserk ? 1 - p.berserkCd / BERSERK.cd : 0,
      berserkReady: p.hasBerserk && p.berserkCd <= 0,
      hasBerserk: p.hasBerserk,
      weapons: p.weapons.map((w) => ({
        id: w.id,
        level: w.level,
        color: weaponColor(w.id),
        name: wDef(w.id)?.name || w.id,
        desc: wDef(w.id)?.desc || '',
      })),
      passives: p.passives.map((x) => ({
        id: x.id,
        level: x.level,
        name: pDef(x.id)?.name || x.id,
        desc: pDef(x.id)?.desc || '',
      })),
    };
  }

  result() {
    return {
      won: this.won,
      time: this.time,
      kills: this.killCount,
      coins: Math.floor(this.coinsRun),
      level: this.player.level,
      charId: this.char.id,
      mapId: this.map.id,
    };
  }
}
