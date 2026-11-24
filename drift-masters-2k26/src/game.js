import {
  TRACKS, UPGRADES, CAR_COLORS, RIM_COLORS, MEDAL_ICON,
  loadSave, writeSave, sanitizeSave, upgradeCost, clamp, formatTime,
  getTrack, sampleClosedPath, buildCheckpoints, nearestOnPath, medalFor,
  carParams, createCar, stepCar, resolveTrackBounds, driftPoints,
} from './core.js';
import { GameAudio } from './audio.js';
import { GameWorld, drawMinimap } from './world.js';

const $ = (id) => document.getElementById(id);
const save = loadSave(window.localStorage);
const audio = new GameAudio(save.settings);
const world = new GameWorld($('scene'), save.settings, save.tuning);

let screenName = 'menu';
let settingsReturn = 'menu';
let activeTab = 'trening';
let mode = 'menu';
let phase = 'idle';
let track = null;
let car = createCar();
let raceTime = 0;
let score = 0;
let combo = 1;
let comboTimer = 0;
let driftSession = 0;
let currentCp = 0;
let lap = 1;
let countdown = 0;
let lastBeep = -1;
let lastTime = performance.now();
let smokeTimer = 0;
let crashCooldown = 0;
let lastDriftAngle = 0;

const keys = Object.create(null);
const touch = { steer: 0, gas: false, brake: false, handbrake: false, nitro: false };
const mouse = { active: false, steer: 0, startX: 0, startSteer: 0 };

// ---------------------------------------------------------------------------
// Ekrany
// ---------------------------------------------------------------------------

function showScreen(name) {
  screenName = name;
  document.querySelectorAll('.screen').forEach((el) => el.classList.add('hide'));
  if (name !== 'none') $('screen-' + name).classList.remove('hide');
  $('hud').classList.toggle('hide', name !== 'none');
  $('touch-controls').classList.toggle('hide', name !== 'none' || save.settings.controlMode !== 'touch');
}

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 1900);
}

function message(text, duration = 900) {
  const el = $('center-message');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(message.timer);
  message.timer = setTimeout(() => el.classList.remove('show'), duration);
}

function persist() { writeSave(window.localStorage, save); }

// ---------------------------------------------------------------------------
// Lista tras
// ---------------------------------------------------------------------------

function renderTracks() {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === activeTab));
  const list = TRACKS.filter((t) => t.type === activeTab);
  $('track-list').innerHTML = list.map((t, i) => {
    const best = save.best[t.id];
    const medal = best ? MEDAL_ICON[best.medal] || '' : '';
    const bestText = best ? formatTime(best.time) : 'brak wyniku';
    return `<article class="track-card" data-track="${t.id}">
      <div class="num">0${i + 1}</div>
      <h4>${t.name}</h4>
      <div class="desc">${t.desc}</div>
      <div class="meta"><span>${t.laps} ${t.laps === 1 ? 'okrążenie' : 'okrążenia'}</span><span>${t.checkpoints} bramek</span><span>${medal} ${bestText}</span></div>
    </article>`;
  }).join('');
  $('track-list').querySelectorAll('[data-track]').forEach((card) => {
    card.addEventListener('click', () => startRace(card.dataset.track));
  });
}

// ---------------------------------------------------------------------------
// Garaż
// ---------------------------------------------------------------------------

function tuningStats(t) {
  const p = carParams(t);
  return [
    ['Prędkość', clamp(Math.round((p.maxSpeed - 39) / 14 * 62 + 38), 0, 100)],
    ['Przyspieszenie', clamp(Math.round((p.accel - 10.2) / 8.75 * 65 + 35), 0, 100)],
    ['Przyczepność', clamp(Math.round(p.grip / 5.9 * 100), 0, 100)],
    ['Sterowanie', clamp(Math.round(p.maxYaw / 2.1 * 100), 0, 100)],
    ['Skłonność do driftu', clamp(Math.round((9.9 - p.grip) / 5 * 100), 0, 100)],
  ];
}

function renderGarage() {
  $('menu-credits').textContent = save.credits + ' CR';
  $('garage-credits').textContent = save.credits + ' CR';
  $('color-swatches').innerHTML = CAR_COLORS.map((c) =>
    `<div class="swatch ${c === save.tuning.color ? 'active' : ''}" style="background:${c}" data-color="${c}"></div>`).join('');
  $('color-swatches').querySelectorAll('[data-color]').forEach((el) => el.addEventListener('click', () => {
    save.tuning.color = el.dataset.color; persist(); renderGarage(); world.showShowroom(save.tuning);
  }));
  $('rim-options').innerHTML = RIM_COLORS.map((r) =>
    `<div class="chip ${r === save.tuning.rim ? 'active' : ''}" data-rim="${r}">${r === 'silver' ? 'Srebrne' : r === 'black' ? 'Czarne' : 'Złote'}</div>`).join('');
  $('rim-options').querySelectorAll('[data-rim]').forEach((el) => el.addEventListener('click', () => {
    save.tuning.rim = el.dataset.rim; persist(); renderGarage(); world.showShowroom(save.tuning);
  }));
  $('tune-spoiler').checked = save.tuning.spoiler;
  $('tune-neon').checked = save.tuning.neon;

  $('upgrade-list').innerHTML = UPGRADES.map((u) => {
    const lvl = save.tuning[u.key];
    const cost = upgradeCost(lvl);
    const pips = Array.from({ length: u.max }, (_, i) => `<i class="pip ${i < lvl ? 'on' : ''}"></i>`).join('');
    return `<div class="upgrade"><div class="info"><b>${u.name} · ${lvl}/${u.max}</b><small>${u.desc}</small><div class="pips">${pips}</div></div>
      <button data-up="${u.key}" data-dir="-1" ${lvl <= 0 ? 'disabled' : ''}>−</button>
      <button data-up="${u.key}" data-dir="1" ${lvl >= u.max || save.credits < cost ? 'disabled' : ''}>+ ${cost}</button></div>`;
  }).join('');
  $('upgrade-list').querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => {
    const key = b.dataset.up, dir = Number(b.dataset.dir);
    const u = UPGRADES.find((x) => x.key === key);
    const lvl = save.tuning[key];
    if (dir > 0) {
      const cost = upgradeCost(lvl);
      if (lvl >= u.max || save.credits < cost) return;
      save.credits -= cost; save.tuning[key] = lvl + 1;
      audio.beep(760, 0.09);
    } else {
      if (lvl <= 0) return;
      save.credits += Math.round(upgradeCost(lvl - 1) * 0.6);
      save.tuning[key] = lvl - 1;
      audio.beep(300, 0.09);
    }
    persist(); renderGarage(); world.showShowroom(save.tuning);
  }));

  $('stat-bars').innerHTML = tuningStats(save.tuning).map(([name, v]) =>
    `<div class="stat">${name} <span style="float:right">${v}%</span><div class="bar"><i style="width:${v}%"></i></div></div>`).join('');
}

// ---------------------------------------------------------------------------
// Ustawienia
// ---------------------------------------------------------------------------

const sliderMap = {
  'set-sensitivity': ['sensitivity', 'out-sensitivity', (v) => Number(v).toFixed(2) + '×'],
  'set-camera-distance': ['cameraDistance', 'out-camera-distance', (v) => Number(v).toFixed(1) + ' m'],
  'set-camera-height': ['cameraHeight', 'out-camera-height', (v) => Number(v).toFixed(2) + ' m'],
  'set-fov': ['fov', 'out-fov', (v) => v + '°'],
  'set-draw-distance': ['drawDistance', 'out-draw-distance', (v) => v + ' m'],
  'set-resolution': ['resolution', 'out-resolution', (v) => Math.round(Number(v) * 100) + '%'],
  'set-master': ['master', 'out-master', (v) => Math.round(Number(v) * 100) + '%'],
  'set-engine': ['engine', 'out-engine', (v) => Math.round(Number(v) * 100) + '%'],
  'set-effects': ['effects', 'out-effects', (v) => Math.round(Number(v) * 100) + '%'],
};
const checkboxMap = {
  'set-mouse-steer': 'mouseSteer', 'set-invert': 'invertSteer',
  'set-shadows': 'shadows', 'set-particles': 'particles',
};
const segmentMap = {
  'control-mode': 'controlMode', 'camera-mode': 'cameraMode', 'graphics-quality': 'graphics',
};

function syncSettingsUI() {
  for (const [id, [key, outId, fmt]] of Object.entries(sliderMap)) {
    $(id).value = save.settings[key];
    $(outId).textContent = fmt(save.settings[key]);
  }
  for (const [id, key] of Object.entries(checkboxMap)) $(id).checked = !!save.settings[key];
  for (const [id, key] of Object.entries(segmentMap)) {
    document.querySelectorAll(`#${id} button`).forEach((b) => b.classList.toggle('active', b.dataset.value === save.settings[key]));
  }
}

function afterSettingsChange() {
  persist();
  audio.setVolumes(save.settings);
  world.applyQuality(save.settings);
  $('touch-controls').classList.toggle('hide', mode !== 'race' || save.settings.controlMode !== 'touch');
}

function initSettingsUI() {
  for (const [id, [key, outId, fmt]] of Object.entries(sliderMap)) {
    $(id).addEventListener('input', (e) => {
      save.settings[key] = Number(e.target.value);
      $(outId).textContent = fmt(e.target.value);
      afterSettingsChange();
    });
  }
  for (const [id, key] of Object.entries(checkboxMap)) {
    $(id).addEventListener('change', (e) => { save.settings[key] = e.target.checked; afterSettingsChange(); });
  }
  for (const [id, key] of Object.entries(segmentMap)) {
    document.querySelectorAll(`#${id} button`).forEach((b) => b.addEventListener('click', () => {
      save.settings[key] = b.dataset.value;
      syncSettingsUI(); afterSettingsChange();
    }));
  }
}

// ---------------------------------------------------------------------------
// Rozgrywka
// ---------------------------------------------------------------------------

function startRace(id) {
  audio.init();
  const def = getTrack(id);
  const path = sampleClosedPath(def.points);
  // Kopia definicji: oryginalne dane tras pozostają nienaruszone przy restarcie.
  track = { ...def, path, checkpoints: buildCheckpoints(path, def.checkpoints) };
  world.buildTrack(track, save.tuning);
  const p = track.path[0], n = track.path[1];
  const yaw = Math.atan2(n.x - p.x, n.z - p.z);
  car = createCar(p.x, p.z, yaw);
  raceTime = 0; score = 0; combo = 1; comboTimer = 0; driftSession = 0;
  currentCp = 0; lap = 1; smokeTimer = 0; crashCooldown = 0; lastBeep = -1;
  countdown = 3.6;
  phase = 'countdown';
  mode = 'race';
  Object.keys(keys).forEach((k) => delete keys[k]);
  touch.steer = 0;
  showScreen('none');
  message('PRZYGOTUJ SIĘ', 1200);
}

function restartRace() { if (track) startRace(track.id); }

function quitRace() {
  mode = 'menu'; phase = 'idle';
  audio.silence();
  world.showShowroom(save.tuning);
  renderGarage();
  showScreen('menu');
}

function pauseGame() {
  if (mode !== 'race' || phase === 'finished') return;
  phase = 'paused';
  audio.silence();
  showScreen('pause');
}

function resumeGame() {
  if (mode !== 'race') return;
  phase = countdown > 0 ? 'countdown' : 'race';
  showScreen('none');
  audio.init();
}

function finishRace() {
  phase = 'finished';
  audio.finish();
  audio.silence();
  const medal = medalFor(track, raceTime);
  const reward = Math.round(score / 25) + { gold: 500, silver: 300, bronze: 150, none: 50 }[medal];
  const prev = save.best[track.id];
  const isBest = !prev || raceTime < prev.time;
  if (isBest) save.best[track.id] = { time: raceTime, score, medal };
  save.credits += reward;
  persist();
  $('result-title').textContent = lap > track.laps ? 'KONIEC TRASY!' : 'UKOŃCZONO';
  $('result-medal').textContent = MEDAL_ICON[medal];
  $('result-time').textContent = formatTime(raceTime);
  $('result-score').textContent = score.toLocaleString('pl-PL');
  $('result-best').textContent = formatTime(save.best[track.id].time);
  $('result-credits').textContent = '+' + reward + ' CR';
  $('result-note').textContent = isBest ? 'Nowy rekord! 🎉' : `Do rekordu brakuje ${formatTime(Math.max(0, raceTime - prev.time))}`;
  const idx = TRACKS.findIndex((t) => t.id === track.id);
  $('result-next').classList.toggle('hide', idx >= TRACKS.length - 1);
  showScreen('results');
  renderGarage();
}

function readInput() {
  const s = save.settings;
  let steer = 0, throttle = 0, brake = 0, handbrake = false, nitro = false;
  if (s.controlMode === 'keyboard') {
    if (keys.ArrowLeft || keys.KeyA) steer -= 1;
    if (keys.ArrowRight || keys.KeyD) steer += 1;
    if (keys.ArrowUp || keys.KeyW) throttle = 1;
    if (keys.ArrowDown || keys.KeyS) brake = 1;
    handbrake = !!keys.Space;
    nitro = !!(keys.ShiftLeft || keys.ShiftRight);
    if (s.mouseSteer && mouse.active && steer === 0) steer = mouse.steer;
  } else {
    steer = touch.steer;
    throttle = touch.gas ? 1 : 0;
    brake = touch.brake ? 1 : 0;
    handbrake = touch.handbrake;
    nitro = touch.nitro;
  }
  if (s.invertSteer) steer = -steer;
  return {
    steer: clamp(steer * (0.55 + s.sensitivity * 0.45), -1, 1),
    throttle, brake, handbrake, nitro,
  };
}

function updateHUD(input) {
  const kmh = Math.round(car.speed * 3.6);
  $('hud-speed').textContent = kmh;
  $('hud-time').textContent = formatTime(raceTime);
  const best = save.best[track.id];
  $('hud-best').textContent = best ? 'BEST ' + formatTime(best.time) : '';
  $('hud-lap').textContent = `${Math.min(lap, track.laps)}/${track.laps}`;
  $('hud-cp').textContent = `CP ${currentCp}/${track.checkpoints.length}`;
  $('hud-score').textContent = score.toLocaleString('pl-PL');
  $('hud-gear').textContent = car.gear === -1 ? 'Bieg R' : 'Bieg ' + car.gear;
  $('hud-track-name').textContent = track.name;
  $('nitro-fill').style.width = car.nitro + '%';
  const driftEl = $('drift-popup');
  const drifting = Math.abs(car.driftAngle) > 14 && car.speed > 8;
  driftEl.classList.toggle('show', drifting);
  if (drifting) {
    $('drift-angle').textContent = Math.round(Math.abs(car.driftAngle)) + '°';
    $('drift-score').textContent = '+' + Math.round(driftPoints(kmh, car.driftAngle, 0.1) * 10 * combo);
  }
  $('combo-popup').textContent = combo > 1.05 ? `x${combo.toFixed(1)} KOMBO` : '';
  drawMinimap($('minimap').getContext('2d'), track, car, currentCp);
}

function tickRace(dt) {
  const input = readInput();
  const params = carParams(save.tuning);
  params.maxYaw *= 0.7 + save.settings.sensitivity * 0.3;
  stepCar(car, input, params, dt);

  const proj = nearestOnPath(track.path, car.x, car.z);
  if (resolveTrackBounds(car, proj, track.width / 2) && crashCooldown <= 0) {
    audio.crash();
    world.shake = 0.55;
    crashCooldown = 0.7;
    combo = 1; comboTimer = 0;
  }
  crashCooldown -= dt;

  const kmh = car.speed * 3.6;
  const gained = driftPoints(kmh, car.driftAngle, dt);
  if (gained > 0) {
    score += Math.round(gained * combo);
    driftSession += dt;
    comboTimer = 1.25;
    if (driftSession > 0.8 + combo * 0.45) {
      combo = Math.min(5, combo + 0.5);
      driftSession = 0;
    }
  } else if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) { combo = 1; driftSession = 0; }
  }

  if (Math.abs(car.driftAngle) > 11 && car.speed > 8 && save.settings.particles) {
    world.addSkid(car.x, car.z, car.yaw, track.width / 2);
    smokeTimer -= dt;
    if (smokeTimer <= 0) { world.spawnSmoke(car.x, car.z, car.yaw); smokeTimer = 0.045; }
  }
  lastDriftAngle = car.driftAngle;

  // Bramki w kolejności
  const cp = track.checkpoints[currentCp];
  if (cp) {
    const d = Math.hypot(car.x - cp.x, car.z - cp.z);
    if (d < track.width * 0.85) {
      world.setGateState(currentCp, true);
      audio.checkpoint();
      currentCp++;
      if (currentCp >= track.checkpoints.length) {
        currentCp = 0;
        lap++;
        world.gates.forEach((_, i) => world.setGateState(i, false));
        if (lap > track.laps) { finishRace(); return; }
        message(`OKRĄŻENIE ${lap}/${track.laps}`);
      }
    }
  }

  raceTime += dt;
  audio.update(car.speed, input.throttle, car.driftAngle, car.boost);
  world.applyCar(world.carGroup, car, input.steer, dt);
  world.updateCamera(car, dt, save.settings);
  world.updateSmoke(dt);
  world.render();
  if (Math.floor(raceTime * 30) !== Math.floor((raceTime - dt) * 30)) updateHUD(input);
}

function tickCountdown(dt) {
  countdown -= dt;
  const n = Math.ceil(countdown - 0.6);
  if (n !== lastBeep && n >= 0 && n <= 3) {
    lastBeep = n;
    audio.countdown(n);
    message(n === 0 ? 'START!' : String(n), n === 0 ? 800 : 700);
  }
  const input = readInput();
  world.applyCar(world.carGroup, car, input.steer, dt);
  world.updateCamera(car, dt, save.settings);
  world.updateSmoke(dt);
  world.render();
  updateHUD(input);
  if (countdown <= 0) { phase = 'race'; countdown = 0; }
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;
  if (mode === 'menu') {
    world.showroomTick(dt);
    world.render();
  } else if (phase === 'race') tickRace(dt);
  else if (phase === 'countdown') tickCountdown(dt);
  else world.render();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Wejście
// ---------------------------------------------------------------------------

function initInput() {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    keys[e.code] = true;
    audio.init();
    if (e.code === 'Escape') {
      if (phase === 'paused') resumeGame();
      else if (phase === 'race' || phase === 'countdown') pauseGame();
    }
    if (e.code === 'KeyR' && mode === 'race' && phase !== 'finished') restartRace();
    if (e.code === 'KeyC' && mode === 'race') {
      save.settings.cameraMode = save.settings.cameraMode === 'chase' ? 'hood' : 'chase';
      persist(); syncSettingsUI();
      toast(save.settings.cameraMode === 'chase' ? 'Kamera za autem' : 'Kamera z wnętrza');
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => Object.keys(keys).forEach((k) => delete keys[k]));

  const canvas = $('scene');
  canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'race' || save.settings.controlMode !== 'keyboard') return;
    audio.init();
    mouse.active = true;
    mouse.startX = e.clientX;
    mouse.startSteer = mouse.steer;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!mouse.active || mode !== 'race' || save.settings.controlMode !== 'keyboard') return;
    mouse.steer = clamp(mouse.startSteer + (e.clientX - mouse.startX) / (window.innerWidth * 0.24), -1, 1);
  });
  const endMouse = () => { mouse.active = false; mouse.steer *= 0.3; };
  canvas.addEventListener('pointerup', endMouse);
  canvas.addEventListener('pointercancel', endMouse);

  const pad = $('steer-pad'), knob = $('steer-knob');
  const setPad = (e) => {
    const r = pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    touch.steer = clamp(dx / (r.width * 0.4), -1, 1);
    knob.style.transform = `translateX(${touch.steer * r.width * 0.3}px)`;
  };
  pad.addEventListener('pointerdown', (e) => { audio.init(); pad.setPointerCapture(e.pointerId); setPad(e); });
  pad.addEventListener('pointermove', (e) => { if (pad.hasPointerCapture(e.pointerId)) setPad(e); });
  const resetPad = (e) => {
    if (pad.hasPointerCapture && pad.hasPointerCapture(e.pointerId)) pad.releasePointerCapture(e.pointerId);
    touch.steer = 0; knob.style.transform = 'translateX(0)';
  };
  pad.addEventListener('pointerup', resetPad);
  pad.addEventListener('pointercancel', resetPad);

  document.querySelectorAll('[data-control]').forEach((btn) => {
    const key = btn.dataset.control;
    const set = (v) => {
      touch[key] = v;
      btn.classList.toggle('active', v);
      if (v) audio.init();
    };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.setPointerCapture(e.pointerId); set(true); });
    btn.addEventListener('pointerup', () => set(false));
    btn.addEventListener('pointercancel', () => set(false));
    btn.addEventListener('lostpointercapture', () => set(false));
  });

  // Android Bridge — pozwala zamknąć grę przyciskiem Wstecz przez WebView.
  window.dmBack = () => {
    if (phase === 'paused') resumeGame();
    else if (mode === 'race') pauseGame();
    else if (screenName !== 'menu') showScreen('menu');
  };
}

function initActions() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    audio.init();
    audio.beep(620, 0.07, 'sine', 0.1);
    switch (btn.dataset.action) {
      case 'goto-modes': renderTracks(); showScreen('modes'); break;
      case 'goto-garage': renderGarage(); showScreen('garage'); world.showShowroom(save.tuning); break;
      case 'goto-settings': settingsReturn = screenName; syncSettingsUI(); showScreen('settings'); break;
      case 'pause-settings': settingsReturn = 'pause'; syncSettingsUI(); showScreen('settings'); break;
      case 'settings-back': showScreen(settingsReturn); break;
      case 'goto-help': showScreen('help'); break;
      case 'goto-menu': quitRace(); break;
      case 'reset-settings':
        save.settings = sanitizeSave(null).settings;
        persist(); syncSettingsUI(); afterSettingsChange();
        toast('Ustawienia przywrócone');
        break;
      case 'resume': resumeGame(); break;
      case 'restart': restartRace(); break;
      case 'retry': restartRace(); break;
      case 'quit': quitRace(); break;
      case 'next-track': {
        const idx = TRACKS.findIndex((t) => t.id === track.id);
        if (idx < TRACKS.length - 1) startRace(TRACKS[idx + 1].id);
        break;
      }
    }
  });
}

function boot() {
  initInput();
  initActions();
  initSettingsUI();
  syncSettingsUI();
  renderGarage();
  world.showShowroom(save.tuning);
  showScreen('menu');
  window.addEventListener('resize', () => world.resize());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && phase === 'race') pauseGame();
  });
  requestAnimationFrame(frame);
}

boot();
