import { META_POWERUPS, META_UNLOCKS, CHARACTERS } from './data.js';

const KEY = 'shakhtino-ledovoe-v3';

function emptyChars() {
  const chars = {};
  for (const c of CHARACTERS) chars[c.id] = { xp: 0, lv: 1 };
  return chars;
}

function emptyUnlocks() {
  const u = {};
  for (const x of META_UNLOCKS) u[x.id] = false;
  return u;
}

const defaults = () => ({
  coins: 0,
  power: Object.fromEntries(META_POWERUPS.map((p) => [p.id, 0])),
  unlocks: emptyUnlocks(),
  chars: emptyChars(),
  best: 0,
  runs: 0,
  wins: 0,
});

export function loadMeta() {
  try {
    const raw = JSON.parse(
      localStorage.getItem(KEY)
      || localStorage.getItem('shakhtino-ledovoe-v2')
      || localStorage.getItem('shakhtino-ledovoe-v1')
      || '{}',
    );
    const base = defaults();
    return {
      ...base,
      ...raw,
      power: { ...base.power, ...(raw.power || {}) },
      unlocks: { ...base.unlocks, ...(raw.unlocks || {}) },
      chars: { ...base.chars, ...(raw.chars || {}) },
    };
  } catch {
    return defaults();
  }
}

export function saveMeta(m) {
  localStorage.setItem(KEY, JSON.stringify(m));
}

export function addCoins(m, n) {
  m.coins += Math.max(0, Math.floor(n));
  saveMeta(m);
}

export function metaBonuses(m, charId) {
  const b = {
    hp: 0, might: 1, speed: 1, greed: 1, armor: 0, cooldown: 1,
    magnet: 0, regen: 0, luck: 1, startLevel: 1, revive: 0, area: 0,
  };
  for (const p of META_POWERUPS) {
    const rank = m.power[p.id] || 0;
    if (!rank) continue;
    const v = p.per * rank;
    if (p.key === 'hp') b.hp += v;
    if (p.key === 'might') b.might += v;
    if (p.key === 'speed') b.speed += v;
    if (p.key === 'greed') b.greed += v;
    if (p.key === 'armor') b.armor += v;
    if (p.key === 'cooldown') b.cooldown = Math.max(0.55, b.cooldown - v);
    if (p.key === 'magnet') b.magnet += v;
    if (p.key === 'regen') b.regen += v;
    if (p.key === 'luck') b.luck += v;
    if (p.key === 'startLevel') b.startLevel += v;
    if (p.key === 'revive') b.revive += v;
    if (p.key === 'area') b.area += v;
  }
  const ch = (m.chars && m.chars[charId]) || { lv: 1 };
  const mastery = Math.min(12, Math.max(0, (ch.lv || 1) - 1));
  b.might += mastery * 0.015;
  b.hp += mastery * 4;
  b.armor += mastery * 0.01;
  return b;
}

/** Стартовое оружие героя всегда доступно; остальное — по unlocks. */
export function isWeaponUnlocked(m, weaponId, charId) {
  const ch = CHARACTERS.find((c) => c.id === charId);
  if (ch && ch.start === weaponId) return true;
  for (const u of META_UNLOCKS) {
    if (u.weapon === weaponId && m.unlocks?.[u.id]) return true;
  }
  return false;
}

export function buyPower(m, id) {
  const def = META_POWERUPS.find((p) => p.id === id);
  if (!def) return { ok: false };
  const rank = m.power[id] || 0;
  if (rank >= def.cost.length) return { ok: false, reason: 'max' };
  const cost = def.cost[rank];
  if (m.coins < cost) return { ok: false, reason: 'coins' };
  m.coins -= cost;
  m.power[id] = rank + 1;
  saveMeta(m);
  return { ok: true };
}

export function buyUnlock(m, id) {
  const def = META_UNLOCKS.find((u) => u.id === id);
  if (!def) return { ok: false };
  if (m.unlocks?.[id]) return { ok: false, reason: 'owned' };
  if (m.coins < def.cost) return { ok: false, reason: 'coins' };
  m.coins -= def.cost;
  if (!m.unlocks) m.unlocks = emptyUnlocks();
  m.unlocks[id] = true;
  saveMeta(m);
  return { ok: true };
}

export function grantRunMastery(m, charId, res) {
  if (!m.chars[charId]) m.chars[charId] = { xp: 0, lv: 1 };
  const c = m.chars[charId];
  const gain = Math.floor(res.time / 18) + Math.floor(res.kills * 0.12) + res.level + (res.won ? 30 : 6);
  c.xp += gain;
  let leveled = 0;
  while (c.xp >= c.lv * 36 && c.lv < 20) {
    c.xp -= c.lv * 36;
    c.lv++;
    leveled++;
  }
  saveMeta(m);
  return { gain, leveled, lv: c.lv, xp: c.xp, need: c.lv * 36 };
}

export function runGoldReward(res, greed = 1) {
  const survival = Math.floor(res.time / 25) * 4;
  const base = res.coins + res.kills * 0.22 + res.level * 2 + survival + (res.won ? 35 : 0);
  return Math.floor(base * Math.max(1, greed || 1));
}
