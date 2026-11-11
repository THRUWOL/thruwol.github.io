import { CHARACTERS, META_POWERUPS, META_UNLOCKS, MAP, VIEW } from './data.js';
import { loadMeta, saveMeta, addCoins, buyPower, buyUnlock, grantRunMastery, runGoldReward, metaBonuses } from './meta.js';
import { unlockAudio, toggleMute, setMusicDuck } from './audio.js';
import { loadSprites, iconUrl } from './sprites.js';
import { Game } from './game.js';

const $ = (s) => document.querySelector(s);
const meta = loadMeta();
let selectedChar = CHARACTERS[0].id;
let game = null;
let raf = 0;
let last = 0;
let muted = false;

function syncMuteButtons() {
  const label = muted ? 'Звук: выкл' : 'Звук: вкл';
  const menu = $('#btn-mute');
  const run = $('#btn-mute-run');
  if (menu) menu.textContent = label;
  if (run) run.textContent = muted ? 'Звук выкл' : 'Звук';
}

function fitCanvas(canvas) {
  if (!canvas) return;
  const stage = canvas.parentElement;
  if (!stage) return;
  const sw = stage.clientWidth;
  const sh = stage.clientHeight;
  if (sw < 8 || sh < 8) return;
  // Fill stage while keeping 16:9; pixelated CSS keeps crisp look.
  const scale = Math.min(sw / VIEW.w, sh / VIEW.h);
  canvas.classList.add('fit-int');
  canvas.style.width = `${VIEW.w * scale}px`;
  canvas.style.height = `${VIEW.h * scale}px`;
}

const FAST = new URLSearchParams(location.search).has('fast');
const TIME_SCALE = FAST ? 14 : 1;

function show(id) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.hidden = el.id !== id;
  });
  $('#overlay').hidden = true;
}

function refreshCoins() {
  $('#coin-label').textContent = String(meta.coins | 0);
}

function renderChars() {
  const grid = $('#char-grid');
  grid.innerHTML = '';
  for (const c of CHARACTERS) {
    const b = document.createElement('button');
    b.className = 'pick' + (c.id === selectedChar ? ' selected' : '');
    b.innerHTML = `
      <span class="portrait-frame" style="--c:${c.color}">
        <img class="portrait" src="assets/sprites/${c.id}.png" alt="" width="72" height="80">
      </span>
      <h3>${c.name}</h3>
      <p>${c.blurb}</p>
      <span class="tag">${c.traitDesc || ''} · старт: ${weaponLabel(c.start)}</span>`;
    b.onclick = () => {
      selectedChar = c.id;
      $('#btn-start').disabled = false;
      renderChars();
    };
    grid.appendChild(b);
  }
  $('#btn-start').disabled = !selectedChar;
}

function weaponLabel(id) {
  return ({
    kruzhka: 'кружка', bochonok: 'бочонок', pena: 'пена',
  })[id] || id;
}

function renderPowerups() {
  const grid = $('#power-grid');
  grid.innerHTML = '';
  const stats = document.createElement('div');
  stats.className = 'meta-stats';
  const ch = meta.chars?.[selectedChar] || { lv: 1, xp: 0 };
  stats.innerHTML = `
    <p><b>Забегов:</b> ${meta.runs || 0} · <b>Побед:</b> ${meta.wins || 0} · <b>Рекорд:</b> ${fmt(meta.best || 0)}</p>
    <p><b>Мастерство</b> выбранного героя: ур. ${ch.lv} · ${ch.xp|0}/${(ch.lv || 1) * 36} XP</p>
    <p class="note">Без закупок первый поход на барона почти нереален — копи золото и качай ветки.</p>`;
  grid.appendChild(stats);

  let lastGroup = '';
  for (const p of META_POWERUPS) {
    if (p.group && p.group !== lastGroup) {
      lastGroup = p.group;
      const h = document.createElement('h3');
      h.className = 'meta-group';
      h.textContent = ({ тело: 'Тело', бой: 'Бой', путь: 'Путь', судьба: 'Судьба' })[p.group] || p.group;
      grid.appendChild(h);
    }
    const rank = meta.power[p.id] || 0;
    const maxed = rank >= p.cost.length;
    const cost = maxed ? '—' : p.cost[rank];
    const b = document.createElement('button');
    b.className = 'card-btn';
    b.disabled = maxed || meta.coins < cost;
    b.innerHTML = `<h3>${p.name}</h3><p>${p.desc}</p><span class="tag">ур. ${rank}/${p.cost.length} · ${maxed ? 'МАКС' : cost + ' золота'}</span>`;
    b.onclick = () => {
      const r = buyPower(meta, p.id);
      if (r.ok) {
        refreshCoins();
        renderPowerups();
      }
    };
    grid.appendChild(b);
  }

  const uh = document.createElement('h3');
  uh.className = 'meta-group';
  uh.textContent = 'Рецепты оружия';
  grid.appendChild(uh);
  for (const u of META_UNLOCKS) {
    const owned = !!meta.unlocks?.[u.id];
    const b = document.createElement('button');
    b.className = 'card-btn';
    b.disabled = owned || meta.coins < u.cost;
    b.innerHTML = `<h3>${u.name}</h3><p>${u.desc}</p><span class="tag">${owned ? 'ОТКРЫТО' : u.cost + ' золота'}</span>`;
    b.onclick = () => {
      const r = buyUnlock(meta, u.id);
      if (r.ok) { refreshCoins(); renderPowerups(); }
    };
    grid.appendChild(b);
  }
}

function showPauseMenu(paused) {
  setMusicDuck(!!paused);
  if (!paused) {
    if ($('#overlay') && !$('#overlay-body')?.querySelector('[data-pick]')) {
      // only hide if it's our pause card
      const body = $('#overlay-body');
      if (body && body.dataset.pause === '1') $('#overlay').hidden = true;
    }
    return;
  }
  showOverlay(`
    <h2>Пауза</h2>
    <p class="lede">Лёд подождёт. Золото и мета — между забегами.</p>
    <div class="row">
      <button class="btn primary" id="btn-resume">Продолжить</button>
      <button class="btn" id="btn-pause-mute">${muted ? 'Звук: выкл' : 'Звук: вкл'}</button>
      <button class="btn" id="btn-quit-run">Сдаться</button>
    </div>
  `);
  $('#overlay-body').dataset.pause = '1';
  $('#btn-resume').onclick = () => { game?.togglePause(); };
  $('#btn-pause-mute').onclick = () => {
    muted = toggleMute();
    syncMuteButtons();
    $('#btn-pause-mute').textContent = muted ? 'Звук: выкл' : 'Звук: вкл';
  };
  $('#btn-quit-run').onclick = () => {
    // endRun → onOver/showResult replaces this pause overlay; do not hide it
    if (game) game.endRun(false);
  };
}

function updateHud() {
  if (!game) return;
  const h = game.hud();
  $('#hud-name').textContent = h.name;
  $('#hud-map').textContent = h.map;
  $('#hud-time').textContent = h.time;
  $('#hud-lv').textContent = `Ур. ${h.level}`;
  $('#hud-kills').textContent = `${h.kills} убийств`;
  const hpEl = $('#hp');
  if (hpEl) hpEl.style.width = `${Math.max(0, h.hp * 100)}%`;
  const hpText = $('#hud-hp-text');
  if (hpText) hpText.textContent = h.hpText || '';
  const xpEl = $('#xp');
  if (xpEl) xpEl.style.width = `${Math.max(0, h.xp * 100)}%`;
  const dash = $('#dash');
  $('#dash-i').style.width = `${Math.max(0, Math.min(1, h.dash) * 100)}%`;
  dash.classList.toggle('ready', h.dashReady);

  const ber = $('#berserk');
  if (h.hasBerserk) {
    ber.hidden = false;
    $('#berserk-i').style.width = `${Math.max(0, Math.min(1, h.berserk) * 100)}%`;
    ber.classList.toggle('ready', h.berserkReady);
  } else {
    ber.hidden = true;
  }

  const slot = (x, kind) => {
    const ic = iconUrl(x.id);
    const icon = ic
      ? `<img src="${ic}" alt="">`
      : `<span class="slot-fallback">${x.name.slice(0, 1)}</span>`;
    return `<div class="slot ${kind}" style="--c:${x.color || '#8ec4d8'}" title="${x.name}: ${x.desc}">
      <span class="slot-icon">${icon}</span>
      <b>${x.level}</b>
      <em>${x.name}</em>
    </div>`;
  };
  const wepHtml = h.weapons.map((x) => slot(x, 'wep')).join('');
  const pasHtml = h.passives.map((x) => slot(x, 'pas')).join('');
  $('#weapons').innerHTML = `
    <div class="loadout-label">Оружие и пассивки</div>
    <div class="loadout-row">
      ${wepHtml}
      <span class="loadout-split" aria-hidden="true"></span>
      ${pasHtml || '<span class="muted-hint">Пассивок пока нет</span>'}
    </div>`;
}

function showOverlay(html) {
  $('#overlay-body').innerHTML = html;
  $('#overlay').hidden = false;
}

function showLevelUp(opts) {
  setMusicDuck(true);
  showOverlay(`
    <h2>Новый уровень!</h2>
    <p class="lede">Выбери усиление — пена, кружка или ярость.</p>
    <div class="grid">
      ${opts.map((o, i) => {
    const ic = o.id && o.id !== 'heal' ? iconUrl(o.id) : null;
    const kind = o.type === 'evolve' ? 'эволюция' : o.type === 'passive' ? 'пассивка' : o.type === 'heal' ? 'лечение' : 'оружие';
    return `
        <button class="card-btn pick-card" data-pick="${i}">
          <div class="pick-icon">${ic ? `<img src="${ic}" alt="">` : '<span>✚</span>'}</div>
          <h3 style="color:${o.color || '#fff'}">${o.name}</h3>
          <p>${o.desc}</p>
          <span class="tag">${kind}</span>
        </button>`;
  }).join('')}
    </div>
  `);
  $('#overlay-body').querySelectorAll('[data-pick]').forEach((btn) => {
    btn.onclick = () => {
      const i = +btn.getAttribute('data-pick');
      game.pickLevel(opts[i]);
      $('#overlay').hidden = true;
      setMusicDuck(false);
    };
  });
}

function showResult(res) {
  const greed = game?.player?.greed || metaBonuses(meta, selectedChar).greed || 1;
  const bonus = runGoldReward(res, greed);
  addCoins(meta, bonus);
  meta.runs = (meta.runs || 0) + 1;
  if (res.won) meta.wins = (meta.wins || 0) + 1;
  meta.best = Math.max(meta.best || 0, Math.floor(res.time));
  const mastery = grantRunMastery(meta, selectedChar, res);
  saveMeta(meta);
  refreshCoins();
  showOverlay(`
    <h2>${res.won ? 'Победа на льду!' : 'Пал на Пивном море'}</h2>
    <p>${res.won ? 'Барон Хмельдорф ушёл в пучину. Хмель Шахтино цел.' : 'Баварцы ещё не ушли… Усиль героя шахтинским золотом и иди снова.'}</p>
    <p>Время ${fmt(res.time)} · Ур. ${res.level} · Убийств ${res.kills}</p>
    <p class="lede">+${bonus} золота · мастерство +${mastery.gain} XP${mastery.leveled ? ` · герой → ур. ${mastery.lv}!` : ''}</p>
    <div class="row">
      <button class="btn primary" id="btn-meta">Качать мета</button>
      <button class="btn" id="btn-retry">Ещё раз</button>
      <button class="btn" id="btn-again">Меню</button>
    </div>
  `);
  $('#btn-meta').onclick = () => {
    stopGame();
    renderPowerups();
    show('screen-powerups');
  };
  $('#btn-again').onclick = () => {
    stopGame();
    show('screen-menu');
  };
  $('#btn-retry').onclick = () => {
    stopGame();
    startRun();
  };
}

function fmt(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function stopGame() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (game) { game.destroy(); game = null; }
}

function startRun() {
  unlockAudio();
  stopGame();
  show('screen-run');
  const canvas = $('#game');
  fitCanvas(canvas);
  game = new Game(canvas, meta, { charId: selectedChar }, {
    onLevelUp: (opts) => { if (!FAST) showLevelUp(opts); },
    onLevelPicked: () => { $('#overlay').hidden = true; setMusicDuck(false); },
    onOver: showResult,
    onHud: updateHud,
    onPause: showPauseMenu,
  });
  if (FAST) {
    // Лёгкий буст только для ускоренного QA, не для обычной игры.
    game.player.might += 0.25;
    game.player.armor += 0.1;
    console.log('[qa] fast mode ×', TIME_SCALE, 'auto-pick on');
  }
  last = performance.now();
  updateHud();
  const loop = (now) => {
    const raw = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (game) {
      // In ?fast=1, simulate many steps so a full 10:00 run finishes in ~1 min wall time.
      const steps = FAST ? 8 : 1;
      const stepDt = Math.min(0.05, raw * TIME_SCALE / steps);
      for (let i = 0; i < steps; i++) {
        if (!game || game.over) break;
        // Auto-pick mid level-up in fast QA mode
        if (FAST && game.levelPick) {
          const opts = game.levelPick;
          game.pickLevel(opts[0] || null);
        }
        game.update(stepDt);
      }
      game.draw();
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

document.querySelectorAll('[data-go]').forEach((btn) => {
  btn.addEventListener('click', () => {
    unlockAudio();
    const go = btn.getAttribute('data-go');
    if (go === 'menu') show('screen-menu');
    if (go === 'chars') { renderChars(); show('screen-chars'); }
    if (go === 'powerups') { renderPowerups(); show('screen-powerups'); }
  });
});

$('#btn-start').onclick = () => startRun();
$('#btn-pause').onclick = () => game?.togglePause();
const onMuteClick = () => {
  muted = toggleMute();
  syncMuteButtons();
};
$('#btn-mute').onclick = onMuteClick;
$('#btn-mute-run').onclick = onMuteClick;
window.addEventListener('resize', () => fitCanvas($('#game')));

refreshCoins();
syncMuteButtons();
show('screen-menu');
void MAP;

loadSprites().then(() => {
  console.log('[sprites] loaded');
  fitCanvas($('#game'));
}).catch((e) => console.warn('[sprites]', e));
