/** Загрузка PNG-спрайтов, анимаций и иконок. */

const BASE = new URL('../assets/sprites/', import.meta.url);

const FILES = {
  kirill: 'kirill.png',
  gopnik: 'gopnik.png',
  semeon: 'semeon.png',
  oruzhenosets: 'oruzhenosets.png',
  rytsar: 'rytsar.png',
  metalshchik: 'metalshchik.png',
  penodukh: 'penodukh.png',
  znamenosets: 'znamenosets.png',
  khmeldorf: 'khmeldorf.png',
  prop_ice: 'prop_ice.png',
  prop_crack: 'prop_crack.png',
  prop_snow: 'prop_snow.png',
  prop_barrel: 'prop_barrel.png',
  prop_crate: 'prop_crate.png',
  prop_banner: 'prop_banner.png',
  prop_stake: 'prop_stake.png',
  prop_rock: 'prop_rock.png',
  prop_foam: 'prop_foam.png',
  tile_ice: 'tile_ice.png',
  // anim
  kirill_walk_0: 'kirill_walk_0.png',
  kirill_walk_1: 'kirill_walk_1.png',
  kirill_walk_2: 'kirill_walk_2.png',
  kirill_walk_3: 'kirill_walk_3.png',
  kirill_atk_0: 'kirill_atk_0.png',
  kirill_atk_1: 'kirill_atk_1.png',
  kirill_atk_2: 'kirill_atk_2.png',
  kirill_atk_3: 'kirill_atk_3.png',
  enemy_walk_0: 'enemy_walk_0.png',
  enemy_walk_1: 'enemy_walk_1.png',
  enemy_walk_2: 'enemy_walk_2.png',
  enemy_walk_3: 'enemy_walk_3.png',
  // icons
  icon_kruzhka: 'icon_kruzhka.png',
  icon_bochonok: 'icon_bochonok.png',
  icon_pena: 'icon_pena.png',
  icon_serp: 'icon_serp.png',
  icon_bich: 'icon_bich.png',
  icon_zhiguli: 'icon_zhiguli.png',
  icon_orbit_hmel: 'icon_orbit_hmel.png',
  icon_nakat: 'icon_nakat.png',
  icon_taran: 'icon_taran.png',
  icon_drakon: 'icon_drakon.png',
  icon_might: 'icon_might.png',
  icon_armor: 'icon_armor.png',
  icon_maxhp: 'icon_maxhp.png',
  icon_recovery: 'icon_recovery.png',
  icon_cooldown: 'icon_cooldown.png',
  icon_area: 'icon_area.png',
  icon_speed: 'icon_speed.png',
  icon_magnet: 'icon_magnet.png',
  icon_growth: 'icon_growth.png',
  icon_amount: 'icon_amount.png',
  icon_yarost: 'icon_yarost.png',
  icon_prochnost: 'icon_prochnost.png',
  icon_hmel: 'icon_hmel.png',
};

const cache = Object.create(null);
let ready = false;
let loading = null;

function loadOne(key, file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { cache[key] = img; resolve(img); };
    img.onerror = () => { resolve(null); };
    img.src = new URL(file, BASE).href;
  });
}

export function loadSprites() {
  if (ready) return Promise.resolve(cache);
  if (loading) return loading;
  loading = Promise.all(Object.entries(FILES).map(([k, f]) => loadOne(k, f))).then(() => {
    ready = true;
    return cache;
  });
  return loading;
}

export function spr(key) {
  return cache[key] || null;
}

export function iconUrl(id) {
  const key = `icon_${id}`;
  if (!cache[key]) return null;
  return new URL(FILES[key], BASE).href;
}

export function blit(ctx, key, x, y, opts = {}) {
  const img = cache[key];
  if (!img) return false;
  const scale = opts.scale ?? 1;
  const facing = opts.facing ?? 1;
  const alpha = opts.alpha ?? 1;
  const w = (opts.w ?? img.width) * scale;
  const h = (opts.h ?? img.height) * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (facing < 0) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
  return true;
}

export function blitProp(ctx, key, x, y, size = 64) {
  const img = cache[key];
  if (!img) return false;
  const s = Math.max(1, Math.round(size));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(x), Math.round(y), s, s);
  ctx.restore();
  return true;
}

export function blitTile(ctx, key, x, y, size = 32) {
  const img = cache[key];
  if (!img) return false;
  const s = Math.max(1, Math.round(size));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(x), Math.round(y), s, s);
  ctx.restore();
  return true;
}

/** Кадр анимации: prefix_0..n-1 */
export function animKey(prefix, frame, count = 4) {
  const i = ((frame % count) + count) % count;
  const key = `${prefix}_${i}`;
  return cache[key] ? key : null;
}
