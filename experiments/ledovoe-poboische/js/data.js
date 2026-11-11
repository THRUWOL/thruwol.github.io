/** Легенда Шахтино: Ледовое побоище — данные по вики + оригинал под легенду. */

export const VIEW = { w: 1280, h: 720 };

/** Блокирующие пропы. Баннеры и сугробы сюда не входят — они только декор. */
export const SOLID_PROPS = {
  barrel: { r: 26, size: 64 },
  crate: { r: 24, size: 64 },
  rock: { r: 28, size: 64 },
  stake: { r: 14, size: 64 },
};
export const TIME_LIMIT = 10 * 60;
export const BOSS_AT = TIME_LIMIT - 30;
export const DASH = { mul: 4.4, dur: 0.28, cd: 1.55 };
export const BERSERK = { cd: 12, dur: 0.55, radius: 150, knock: 420 };
export const MAX_WEAPONS = 6;
export const MAX_PASSIVES = 6;
export const MAX_CHOICES = 3;

export const MAP = {
  id: 'ledovoe',
  name: 'Ледовое побоище',
  blurb: '1242 год. Замёрзшее Пивное море. Баварцы лезут за священным хмелем.',
  difficulty: 1,
  tint: '#1a2838',
  goldMul: 1,
  bossAt: BOSS_AT,
};

export const CHARACTERS = [
  {
    id: 'kirill',
    name: 'Кирилл Лунгул',
    blurb: 'Бессмертный пивной голиаф. Кружка — и щит, и молот. «Лунг-гул!»',
    color: '#c8a060',
    accent: '#e8c878',
    hp: 120,
    speed: 148,
    start: 'kruzhka',
    berserk: true,
    trait: 'berserk',
    traitDesc: 'Q — Лунг-гул: волна урона и отброс',
  },
  {
    id: 'gopnik',
    name: 'Шахтинский гопник',
    blurb: 'Гопник-пивовар. Бочонок в ход, пена в лицо, традиции в сердце.',
    color: '#6a8a50',
    accent: '#b8d070',
    hp: 95,
    speed: 172,
    start: 'bochonok',
    berserk: false,
    trait: 'dash_barrel',
    traitDesc: 'Рывок кидает бочонок вперёд',
  },
  {
    id: 'semeon',
    name: 'Хмелевар Семён',
    blurb: 'Хранитель рецептов Семени. Пена замедляет, хмель жжёт.',
    color: '#7a90b0',
    accent: '#a8d0e8',
    hp: 82,
    speed: 160,
    start: 'pena',
    berserk: false,
    trait: 'foam_trail',
    traitDesc: 'В движении оставляет лужи пены',
  },
];

/** Оружия, открываемые за золото (стартовые у героев всегда доступны). */
export const META_UNLOCKS = [
  { id: 'u_serp', weapon: 'serp', name: 'Рецепт серпа', desc: 'Ячменный серп появляется в level-up', cost: 45 },
  { id: 'u_bich', weapon: 'bich', name: 'Рецепт бича', desc: 'Хмелевой бич в пуле карт', cost: 55 },
  { id: 'u_zhiguli', weapon: 'zhiguli', name: 'Рецепт Жигулей', desc: 'Жигулёвский град в пуле', cost: 55 },
  { id: 'u_orbit', weapon: 'orbit_hmel', name: 'Рецепт орбиты', desc: 'Хмелевые шары в пуле', cost: 65 },
  { id: 'u_pena', weapon: 'pena', name: 'Рецепт пены', desc: 'Хмелевая пена доступна всем героям', cost: 40 },
  { id: 'u_bochonok', weapon: 'bochonok', name: 'Рецепт бочонка', desc: 'Бочонок доступен всем героям', cost: 40 },
  { id: 'u_kruzhka', weapon: 'kruzhka', name: 'Рецепт кружки', desc: 'Пивная кружка доступна всем', cost: 40 },
];

export const WEAPONS = {
  kruzhka: {
    id: 'kruzhka', name: 'Пивная кружка', desc: 'Дуга удара перед собой.',
    max: 8,
    cd: [1.15, 1.05, 0.95, 0.88, 0.8, 0.74, 0.68, 0.62],
    dmg: [10, 13, 17, 22, 28, 35, 44, 54],
    area: [95, 105, 115, 125, 135, 145, 155, 170],
    style: 'arc',
    evolvesTo: 'nakat', needsPassive: 'yarost',
  },
  nakat: {
    id: 'nakat', name: 'Кружечный накат', desc: 'Эволюция. Широкий удар + волна пены.',
    max: 1, evolved: true,
    cd: [0.55], dmg: [80], area: [200], amount: [1], style: 'arc',
  },
  bochonok: {
    id: 'bochonok', name: 'Бочонок', desc: 'Крутящийся бочонок по дуге.',
    max: 8,
    cd: [1.35, 1.25, 1.15, 1.05, 0.95, 0.9, 0.85, 0.8],
    dmg: [16, 20, 26, 32, 40, 48, 58, 70],
    amount: [1, 1, 2, 2, 3, 3, 4, 4],
    style: 'orbit_throw',
    evolvesTo: 'taran', needsPassive: 'prochnost',
  },
  taran: {
    id: 'taran', name: 'Разливной таран', desc: 'Эволюция. Тяжёлые бочки с взрывом пены.',
    max: 1, evolved: true,
    cd: [0.75], dmg: [90], amount: [3], style: 'orbit_throw',
  },
  pena: {
    id: 'pena', name: 'Хмелевая пена', desc: 'Облако пены замедляет врагов.',
    max: 8,
    cd: [1.25, 1.15, 1.05, 0.95, 0.9, 0.85, 0.8, 0.75],
    dmg: [10, 13, 16, 20, 25, 31, 38, 46],
    amount: [1, 2, 2, 3, 3, 4, 4, 5],
    style: 'shot', slow: 0.5,
    evolvesTo: 'drakon', needsPassive: 'hmel',
  },
  drakon: {
    id: 'drakon', name: 'Пенный дракон', desc: 'Эволюция. Кольцо пены вокруг героя.',
    max: 1, evolved: true,
    cd: [0.35], dmg: [55], amount: [8], style: 'nova',
  },
  serp: {
    id: 'serp', name: 'Ячменный серп', desc: 'Быстрые режущие серпы.',
    max: 8,
    cd: [0.8, 0.74, 0.68, 0.62, 0.56, 0.52, 0.48, 0.44],
    dmg: [9, 11, 14, 18, 22, 27, 33, 40],
    amount: [1, 2, 2, 3, 3, 4, 4, 5],
    style: 'shot',
    evolvesTo: 'zhatva', needsPassive: 'yarost',
  },
  zhatva: {
    id: 'zhatva', name: 'Жатва солода', desc: 'Эволюция. Широкий крест серпов.',
    max: 1, evolved: true,
    cd: [0.4], dmg: [48], amount: [6], style: 'shot',
  },
  bich: {
    id: 'bich', name: 'Хмелевой бич', desc: 'Цепная молния хмеля.',
    max: 8,
    cd: [1.55, 1.4, 1.3, 1.2, 1.1, 1.0, 0.95, 0.9],
    dmg: [18, 22, 28, 35, 43, 52, 62, 74],
    amount: [2, 2, 3, 3, 4, 4, 5, 5],
    style: 'chain',
    evolvesTo: 'groza', needsPassive: 'hmel',
  },
  groza: {
    id: 'groza', name: 'Гроза погреба', desc: 'Эволюция. Длинная цепь ударов.',
    max: 1, evolved: true,
    cd: [0.85], dmg: [70], amount: [7], style: 'chain',
  },
  zhiguli: {
    id: 'zhiguli', name: 'Жигулёвский град', desc: 'Бутылки разливного по дуге.',
    max: 8,
    cd: [1.4, 1.3, 1.2, 1.1, 1.0, 0.95, 0.9, 0.85],
    dmg: [12, 15, 19, 24, 30, 37, 45, 55],
    amount: [1, 1, 2, 2, 3, 3, 4, 4],
    style: 'shot',
    evolvesTo: 'zavod', needsPassive: 'prochnost',
  },
  zavod: {
    id: 'zavod', name: 'Ящик с завода', desc: 'Эволюция. Бутылки с лужами пены.',
    max: 1, evolved: true,
    cd: [0.7], dmg: [62], amount: [5], style: 'shot',
  },
  orbit_hmel: {
    id: 'orbit_hmel', name: 'Хмелевые шары', desc: 'Орбитальные шишки хмеля.',
    max: 8,
    cd: [0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25],
    dmg: [7, 9, 11, 14, 17, 21, 26, 32],
    amount: [1, 2, 2, 3, 3, 4, 4, 5],
    style: 'orbit',
    evolvesTo: 'poyas', needsPassive: 'amount',
  },
  poyas: {
    id: 'poyas', name: 'Пояс пивовара', desc: 'Эволюция. Плотный орбитальный пояс.',
    max: 1, evolved: true,
    cd: [0.25], dmg: [40], amount: [8], style: 'orbit',
  },
};

export const PASSIVES = {
  might: { id: 'might', name: 'Сила разлива', desc: '+10% урона', max: 5, key: 'might', per: 0.1 },
  armor: { id: 'armor', name: 'Дубовая клёпка', desc: '+8% сопротивления', max: 5, key: 'armor', per: 0.08 },
  maxhp: { id: 'maxhp', name: 'Пивной запас', desc: '+22 макс. HP', max: 5, key: 'maxhp', per: 22 },
  recovery: { id: 'recovery', name: 'Хмелевая брага', desc: '+0.55 HP/с', max: 5, key: 'recovery', per: 0.55 },
  cooldown: { id: 'cooldown', name: 'Быстрый розлив', desc: '−6% перезарядки', max: 5, key: 'cooldown', per: 0.06 },
  area: { id: 'area', name: 'Широкая пена', desc: '+8% области', max: 5, key: 'area', per: 0.08 },
  speed: { id: 'speed', name: 'Скользкие валенки', desc: '+8% скорости', max: 5, key: 'speed', per: 0.08 },
  magnet: { id: 'magnet', name: 'Жажда опыта', desc: '+40 радиуса подбора', max: 5, key: 'magnet', per: 40 },
  growth: { id: 'growth', name: 'Дрожжи опыта', desc: '+8% опыта', max: 5, key: 'growth', per: 0.08 },
  amount: { id: 'amount', name: 'Лишняя кружка', desc: '+1 снаряд', max: 3, key: 'amount', per: 1 },
  yarost: {
    id: 'yarost',
    name: 'Ярость Лунгула',
    desc: '+6% силы за уровень. На 1 ур. открывает эволюцию кружки в «Лунг-гул накат».',
    max: 5,
    key: 'might',
    per: 0.06,
  },
  prochnost: {
    id: 'prochnost', name: 'Прочность обруча',
    desc: '+5% брони. Открывает эволюции бочонка и Жигулей.',
    max: 5, key: 'armor', per: 0.05,
  },
  hmel: {
    id: 'hmel', name: 'Яростный хмель',
    desc: '+6% области. Открывает эволюции пены и бича.',
    max: 5, key: 'area', per: 0.06,
  },
};

export const ENEMIES = {
  oruzhenosets: {
    id: 'oruzhenosets', name: 'Баварский оруженосец',
    hp: 42, speed: 76, dmg: 6, xp: 1, r: 15, color: '#8a5060',
  },
  rytsar: {
    id: 'rytsar', name: 'Рыцарь-пивовар',
    hp: 110, speed: 48, dmg: 10, xp: 3, r: 20, color: '#703040', charge: true,
  },
  metalshchik: {
    id: 'metalshchik', name: 'Метатель Beck\'s',
    hp: 72, speed: 52, dmg: 8, xp: 3, r: 17, color: '#607888', shoot: 2.1,
  },
  penodukh: {
    id: 'penodukh', name: 'Пенодух',
    hp: 88, speed: 64, dmg: 9, xp: 4, r: 18, color: '#d8c890', explode: 70, slowAura: true,
  },
  znamenosets: {
    id: 'znamenosets', name: 'Знаменосец кружки',
    hp: 130, speed: 44, dmg: 9, xp: 5, r: 19, color: '#c0a050', buff: true,
  },
  khmeldorf: {
    id: 'khmeldorf', name: 'Барон Хмельдорф',
    hp: 9000, speed: 52, dmg: 18, xp: 160, r: 42, color: '#a02838',
    boss: true, charge: true, shoot: 1.7,
  },
  zhnec: {
    id: 'zhnec', name: 'Трезвый жнец',
    hp: 99999, speed: 105, dmg: 40, xp: 0, r: 22, color: '#1a1020',
    reaper: true,
  },
};

/** Карта событий в духе Vampire Survivors. */
export const MAP_EVENTS = {
  firstAt: 42,
  every: 70,
  defend: { dur: 22, radius: 130, waves: 4, pack: 3, label: 'Удержи бочку!' },
  elite: { hpMul: 9, xpMul: 12, label: 'Мини-босс!' },
};

export const WAVES = [
  { until: 45, pack: ['oruzhenosets'], w: [1] },
  { until: 90, pack: ['oruzhenosets', 'rytsar'], w: [3, 1] },
  { until: 150, pack: ['oruzhenosets', 'rytsar', 'metalshchik'], w: [2, 2, 1] },
  { until: 240, pack: ['rytsar', 'metalshchik', 'penodukh'], w: [2, 2, 1] },
  { until: 360, pack: ['rytsar', 'metalshchik', 'penodukh', 'znamenosets'], w: [2, 2, 2, 1] },
  { until: 600, pack: ['rytsar', 'metalshchik', 'penodukh', 'znamenosets'], w: [2, 3, 2, 2] },
];

export const SPECIALS = [
  { at: 60, type: 'swarm', enemy: 'oruzhenosets', n: 14, label: 'Первый натиск!' },
  { at: 120, type: 'wall', enemy: 'rytsar', n: 10, label: 'Стена рыцарей!' },
  { at: 180, type: 'swarm', enemy: 'metalshchik', n: 12, label: 'Град Beck\'s!' },
  { at: 270, type: 'swarm', enemy: 'penodukh', n: 10, label: 'Пена идёт!' },
  { at: 360, type: 'wall', enemy: 'znamenosets', n: 8, label: 'Знамена баварцев!' },
  { at: 480, type: 'swarm', enemy: 'rytsar', n: 16, label: 'Последний вал!' },
];

/** Вечные апгрейды между забегами. Без них первый проход тяжёлый — как в VS. */
export const META_POWERUPS = [
  { id: 'm_hp', name: 'Живучесть', desc: '+12 стартового HP', cost: [15, 35, 60, 95, 140, 200], key: 'hp', per: 12, group: 'тело' },
  { id: 'm_armor', name: 'Дубовая клёпка', desc: '+4% сопротивления урону', cost: [20, 45, 75, 115, 170], key: 'armor', per: 0.04, group: 'тело' },
  { id: 'm_regen', name: 'Хмелевая брага', desc: '+0.25 HP/с вне боя-паузы', cost: [25, 55, 90, 140], key: 'regen', per: 0.25, group: 'тело' },
  { id: 'm_might', name: 'Удар хмеля', desc: '+5% урона', cost: [20, 45, 80, 125, 180, 250], key: 'might', per: 0.05, group: 'бой' },
  { id: 'm_cdr', name: 'Быстрый розлив', desc: '−4% перезарядки оружия', cost: [25, 55, 95, 150, 220], key: 'cooldown', per: 0.04, group: 'бой' },
  { id: 'm_area', name: 'Широкая пена', desc: '+5% области', cost: [20, 50, 90, 140], key: 'area', per: 0.05, group: 'бой' },
  { id: 'm_start', name: 'Закалка старта', desc: '+1 уровень стартового оружия', cost: [70, 150, 280], key: 'startLevel', per: 1, group: 'бой' },
  { id: 'm_speed', name: 'Бег по льду', desc: '+4% скорости', cost: [15, 40, 70, 110, 160], key: 'speed', per: 0.04, group: 'путь' },
  { id: 'm_magnet', name: 'Жажда опыта', desc: '+25 радиуса подбора', cost: [20, 50, 90, 140], key: 'magnet', per: 25, group: 'путь' },
  { id: 'm_luck', name: 'Пивная удача', desc: '+6% удачи (крит/дроп)', cost: [30, 70, 120, 180], key: 'luck', per: 0.06, group: 'путь' },
  { id: 'm_coins', name: 'Жажда золота', desc: '+8% монет с забега', cost: [25, 55, 95, 150, 220], key: 'greed', per: 0.08, group: 'путь' },
  { id: 'm_revive', name: 'Похмельный щит', desc: '1 раз за забег: не умереть и восстановить 35% HP', cost: [120, 260], key: 'revive', per: 1, group: 'судьба' },
];

export function xpCapForLevel(level) {
  // Более частые ранние level-up (VS-дофамин)
  if (level < 5) return 4 + (level - 1) * 4;
  if (level < 10) return 8 + (level - 1) * 6;
  if (level < 20) return 16 + (level - 1) * 10;
  return 30 + (level - 1) * 16;
}

export function difficultyAt(t, mapMul = 1) {
  const m = t / 60;
  const swarm = m >= 2 && Math.floor(t) % 40 < 8;
  // Ранние враги живут 3–4 удара кружки; к середине HP растёт круто.
  const early = m < 1.5 ? 1.05 : 1;
  const late = m > 5 ? 1 + (m - 5) * 0.12 : 1;
  return {
    hp: Math.pow(1.15, m) * mapMul * early * late,
    speed: (1 + m * 0.03) * (0.95 + mapMul * 0.05),
    dmg: (1 + m * 0.024) * mapMul,
    every: Math.max(0.26, (1.4 - m * 0.09 - (swarm ? 0.22 : 0)) / mapMul),
    pack: Math.floor((swarm ? 2 : 1) + m * 0.75 * mapMul),
  };
}

export function weighted(list, weights) {
  let total = 0;
  for (const w of weights) total += w;
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

export function charById(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}

export function weaponColor(id) {
  return ({
    kruzhka: '#e8c878', nakat: '#ffe090', bochonok: '#a87840', taran: '#d0a050',
    pena: '#e8e0c0', drakon: '#f0e8a0', serp: '#c0d080', zhatva: '#e8f090',
    bich: '#90c060', groza: '#c8f060', zhiguli: '#70a0c8', zavod: '#98c8e8',
    orbit_hmel: '#80b050', poyas: '#a0d060',
  })[id] || '#d0e8ff';
}
