let ctx; let master; let musicG; let sfxG; let muted = false; let on = false;
let bgmSrc = null; let bgmBuf = null; let htmlBgm = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.72; master.connect(ctx.destination);
  musicG = ctx.createGain(); musicG.gain.value = 0.22; musicG.connect(master);
  sfxG = ctx.createGain(); sfxG.gain.value = 0.42; sfxG.connect(master);
  return ctx;
}

function beep(freq, t0, dur, type, node, vol = 0.15) {
  if (!ctx || muted) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(node); o.start(t0); o.stop(t0 + dur + 0.02);
}

async function loadBgm() {
  if (bgmBuf || htmlBgm) return;
  const url = new URL('../assets/audio/bgm.wav', import.meta.url).href;
  try {
    const c = ensure();
    if (c) {
      const res = await fetch(url);
      const ab = await res.arrayBuffer();
      bgmBuf = await c.decodeAudioData(ab.slice(0));
      return;
    }
  } catch (_) { /* fallback below */ }
  htmlBgm = new Audio(url);
  htmlBgm.loop = true;
  htmlBgm.volume = 0.35;
}

function startBgm() {
  if (muted) return;
  if (bgmBuf && ctx) {
    if (bgmSrc) {
      try { bgmSrc.stop(); } catch (_) { /* already stopped */ }
      bgmSrc = null;
    }
    bgmSrc = ctx.createBufferSource();
    bgmSrc.buffer = bgmBuf;
    bgmSrc.loop = true;
    bgmSrc.connect(musicG);
    bgmSrc.start(0);
    return;
  }
  if (htmlBgm) {
    htmlBgm.muted = muted;
    htmlBgm.play().catch(() => {});
  }
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
  void loadBgm().then(() => {
    if (!on) {
      on = true;
      startBgm();
    }
  });
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.72;
  if (htmlBgm) {
    htmlBgm.muted = muted;
    if (!muted) htmlBgm.play().catch(() => {});
  }
  if (!muted && on && bgmBuf && !bgmSrc) startBgm();
  if (muted && bgmSrc) {
    try { bgmSrc.stop(); } catch (_) { /* ignore */ }
    bgmSrc = null;
  }
  return muted;
}

export function setMusicDuck(duck) {
  if (!musicG) return;
  musicG.gain.value = muted ? 0 : (duck ? 0.08 : 0.22);
}

export const sfx = {
  hit() { const c = ensure(); if (!c) return; beep(320, c.currentTime, 0.05, 'square', sfxG, 0.06); },
  cast() { const c = ensure(); if (!c) return; beep(480, c.currentTime, 0.07, 'sine', sfxG, 0.06); },
  dash() { const c = ensure(); if (!c) return; beep(160, c.currentTime, 0.1, 'sawtooth', sfxG, 0.07); },
  lungul() {
    const c = ensure(); if (!c) return;
    const t = c.currentTime;
    beep(120, t, 0.18, 'sawtooth', sfxG, 0.1);
    beep(90, t + 0.12, 0.25, 'triangle', sfxG, 0.09);
    beep(200, t + 0.2, 0.12, 'square', sfxG, 0.05);
  },
  level() { const c = ensure(); if (!c) return; [392, 523, 659, 784].forEach((f, i) => beep(f, c.currentTime + i * 0.06, 0.1, 'sine', sfxG, 0.07)); },
  hurt() { const c = ensure(); if (!c) return; beep(130, c.currentTime, 0.12, 'sawtooth', sfxG, 0.08); },
  pickup() { const c = ensure(); if (!c) return; beep(700, c.currentTime, 0.07, 'sine', sfxG, 0.06); },
  chest() { const c = ensure(); if (!c) return; [440, 554, 659].forEach((f, i) => beep(f, c.currentTime + i * 0.08, 0.12, 'triangle', sfxG, 0.08)); },
};
