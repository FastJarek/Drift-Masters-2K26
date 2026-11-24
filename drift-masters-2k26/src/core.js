// Drift Masters 2K26 — logika gry niezależna od przeglądarki i Three.js.
// Ten plik jest używany zarówno przez grę, jak i przez testy Node.js.

export const SAVE_KEY = 'dm2k26.save.v1';

export const DEFAULT_SAVE = {
  version: 1,
  credits: 0,
  settings: {
    controlMode: 'touch',
    sensitivity: 1,
    mouseSteer: true,
    invertSteer: false,
    cameraDistance: 8,
    cameraHeight: 3.2,
    fov: 68,
    cameraMode: 'chase',
    graphics: 'high',
    shadows: true,
    particles: true,
    drawDistance: 320,
    resolution: 1,
    master: 0.75,
    engine: 0.85,
    effects: 0.8,
  },
  tuning: {
    color: '#2ee9ff', rim: 'silver', spoiler: true, neon: false,
    engine: 0, grip: 0, suspension: 0, drift: 0,
  },
  best: {},
};

export const CAR_COLORS = ['#2ee9ff', '#ff3ea5', '#ffd23f', '#7cff6b', '#ff6b35', '#f2f5ff', '#8a5cff', '#111827'];
export const RIM_COLORS = ['silver', 'black', 'gold'];

export const UPGRADES = [
  { key: 'engine', name: 'Silnik', desc: 'Przyspieszenie i prędkość maksymalna', max: 5 },
  { key: 'grip', name: 'Przyczepność', desc: 'Lepsze wyjście z zakrętu', max: 5 },
  { key: 'suspension', name: 'Zawieszenie', desc: 'Szybsza reakcja na sterowanie', max: 5 },
  { key: 'drift', name: 'Ustawienie driftowe', desc: 'Łatwiejsze i dłuższe poślizgi', max: 5 },
];

export function upgradeCost(level) {
  return 400 + level * 350;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

export function sanitizeSave(raw) {
  const s = JSON.parse(JSON.stringify(DEFAULT_SAVE));
  if (!raw || typeof raw !== 'object') return s;
  const numbers = [
    ['sensitivity', 0.4, 2], ['cameraDistance', 4, 14], ['cameraHeight', 1.5, 7],
    ['fov', 55, 95], ['drawDistance', 80, 600], ['resolution', 0.6, 1.5],
    ['master', 0, 1], ['engine', 0, 1], ['effects', 0, 1],
  ];
  const src = raw.settings || {};
  for (const [k, lo, hi] of numbers) {
    if (Number.isFinite(src[k])) s.settings[k] = clamp(src[k], lo, hi);
  }
  for (const k of ['controlMode', 'cameraMode', 'graphics']) {
    if (typeof src[k] === 'string') s.settings[k] = src[k];
  }
  if (!['touch', 'keyboard'].includes(s.settings.controlMode)) s.settings.controlMode = 'touch';
  if (!['chase', 'hood'].includes(s.settings.cameraMode)) s.settings.cameraMode = 'chase';
  if (!['low', 'medium', 'high'].includes(s.settings.graphics)) s.settings.graphics = 'high';
  for (const k of ['mouseSteer', 'invertSteer', 'shadows', 'particles']) {
    if (typeof src[k] === 'boolean') s.settings[k] = src[k];
  }
  const t = raw.tuning || {};
  if (CAR_COLORS.includes(t.color)) s.tuning.color = t.color;
  if (RIM_COLORS.includes(t.rim)) s.tuning.rim = t.rim;
  for (const k of ['spoiler', 'neon']) if (typeof t[k] === 'boolean') s.tuning[k] = t[k];
  for (const u of UPGRADES) {
    if (Number.isFinite(t[u.key])) s.tuning[u.key] = clamp(Math.round(t[u.key]), 0, u.max);
  }
  if (Number.isFinite(raw.credits)) s.credits = clamp(Math.round(raw.credits), 0, 1e9);
  if (raw.best && typeof raw.best === 'object') {
    for (const [id, v] of Object.entries(raw.best)) {
      if (v && Number.isFinite(v.time) && v.time > 0) {
        s.best[id] = { time: v.time, score: Number(v.score) || 0, medal: v.medal || 'none' };
      }
    }
  }
  return s;
}

export function loadSave(storage) {
  try {
    return sanitizeSave(JSON.parse(storage.getItem(SAVE_KEY)));
  } catch (_) {
    return sanitizeSave(null);
  }
}

export function writeSave(storage, save) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (_) { /* prywatny tryb */ }
}

// ---------------------------------------------------------------------------
// Trasy
// ---------------------------------------------------------------------------

export const TRACKS = [
  {
    id: 'trening-1', type: 'trening', name: 'Pętla Startowa', desc: 'Szeroka pętla do nauki hamowania i pierwszych poślizgów.',
    width: 20, laps: 1, checkpoints: 4, theme: 'city', medals: { gold: 17, silver: 23, bronze: 31 },
    points: [[-62, -28], [-46, -48], [0, -54], [48, -46], [64, -22], [66, 12], [46, 38], [0, 46], [-48, 38], [-66, 10]],
  },
  {
    id: 'trening-2', type: 'trening', name: 'Okrąg Poślizgu', desc: 'Klasyczny skidpad — utrzymaj auto w długim, kontrolowanym poślizgu.',
    width: 17, laps: 1, checkpoints: 4, theme: 'industrial', medals: { gold: 12, silver: 16, bronze: 22 },
    points: Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return [Math.round(Math.cos(a) * 36), Math.round(Math.sin(a) * 36)];
    }),
  },
  {
    id: 'trening-3', type: 'trening', name: 'Slalom Miejski', desc: 'Ciasne łuki i szybkie zmiany kierunku. Ćwicz rytm i gaz.',
    width: 15, laps: 1, checkpoints: 6, theme: 'city', medals: { gold: 24, silver: 32, bronze: 44 },
    points: [[-70, -40], [-35, -45], [-10, -25], [18, -46], [52, -38], [68, -8], [40, 8], [12, 30], [-18, 10], [-50, 32], [-72, 8]],
  },
  {
    id: 'zawody-1', type: 'zawody', name: 'City Night Circuit', desc: 'Nocny obwód miejski. Dwa okrążenia, ostre zakręty i dużo driftu.',
    width: 14, laps: 2, checkpoints: 6, theme: 'city', medals: { gold: 44, silver: 59, bronze: 81 },
    points: [[-80, -50], [-30, -58], [22, -52], [78, -34], [86, 4], [60, 42], [10, 56], [-42, 46], [-84, 20], [-88, -18]],
  },
  {
    id: 'zawody-2', type: 'zawody', name: 'Strefa Przemysłowa', desc: 'Szerokie aleje, szykany i betonowe bariery. Tu liczy się precyzja.',
    width: 13, laps: 2, checkpoints: 8, theme: 'industrial', medals: { gold: 73, silver: 98, bronze: 135 },
    points: [[-92, -36], [-58, -62], [-12, -55], [18, -28], [48, -60], [92, -44], [96, 6], [58, 24], [74, 62], [18, 70], [-24, 42], [-66, 66], [-96, 26]],
  },
  {
    id: 'zawody-3', type: 'zawody', name: 'Górska Przełęcz', desc: 'Wąski, kręty odcinek górski. Najtrudniejsza trasa w grze.',
    width: 12, laps: 1, checkpoints: 9, theme: 'mountain', medals: { gold: 37, silver: 50, bronze: 69 },
    points: [[-96, -18], [-66, -52], [-28, -40], [-6, -72], [32, -62], [52, -28], [88, -36], [96, 8], [58, 30], [70, 70], [22, 78], [-18, 46], [-58, 68], [-94, 34]],
  },
];

export function getTrack(id) {
  return TRACKS.find((t) => t.id === id) || TRACKS[0];
}

/** Catmull-Rom dla zamkniętej pętli — zwraca gęstą środkową linię trasy. */
export function sampleClosedPath(points, perSegment = 14) {
  const path = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i];
    const p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
    for (let j = 0; j < perSegment; j++) {
      const t = j / perSegment, t2 = t * t, t3 = t2 * t;
      const cr = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      path.push({ x: cr(p0[0], p1[0], p2[0], p3[0]), z: cr(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  return path;
}

/** Najbliższy punkt na linii środkowej. Zwraca też wektor stycznej i odległość. */
export function nearestOnPath(path, x, z, hint = -1) {
  let best = { dist: Infinity, index: 0, t: 0, x: 0, z: 0, tx: 0, tz: 1 };
  const n = path.length;
  // Szukanie w okolicy wskazówki jest szybsze, ale dla pewności sprawdzamy całą trasę.
  for (let i = 0; i < n; i++) {
    const a = path[i], b = path[(i + 1) % n];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / len2, 0, 1);
    const px = a.x + dx * t, pz = a.z + dz * t;
    const d2 = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (d2 < best.dist * best.dist) {
      const len = Math.sqrt(len2);
      best = { dist: Math.sqrt(d2), index: i, t, x: px, z: pz, tx: dx / len, tz: dz / len };
    }
  }
  return best;
}

export function buildCheckpoints(path, count) {
  const cps = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((((i + 1) / (count + 1)) % 1) * path.length);
    const p = path[idx];
    const nx = path[(idx + 1) % path.length];
    cps.push({ x: p.x, z: p.z, yaw: Math.atan2(nx.x - p.x, nx.z - p.z), index: idx });
  }
  return cps;
}

export function trackLength(path) {
  let len = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length];
    len += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return len;
}

export function medalFor(track, time) {
  if (time <= track.medals.gold) return 'gold';
  if (time <= track.medals.silver) return 'silver';
  if (time <= track.medals.bronze) return 'bronze';
  return 'none';
}

export const MEDAL_ICON = { gold: '🥇', silver: '🥈', bronze: '🥉', none: '—' };

// ---------------------------------------------------------------------------
// Fizyka auta (uproszczony model rowerowy z poślizgiem bocznym)
// ---------------------------------------------------------------------------

/**
 * Parametry fizyczne auta. Model zbliżony do symulacyjnych gier driftowych
 * (CarX): osobne osie przednia/tylna, sztywność opon, koło przyczepności
 * i przenoszenie masy. Ulepszenia w garażu realnie zmieniają te wartości.
 */
export function carParams(tuning) {
  const t = tuning || DEFAULT_SAVE.tuning;
  return {
    mass: 1150,          // kg
    a: 1.15,             // odległość środka ciężkości od osi przedniej
    b: 1.45,             // ... i tylnej
    inertia: 1350,       // kg·m²
    cgHeight: 0.52,
    gravity: 9.81,
    engineForce: 7000 + t.engine * 1200,   // N na kołach
    brakeForce: 9500,
    reverseForce: 3000,
    boostForce: 4600,
    maxSpeed: 42 + t.engine * 3,
    steerMax: 0.55 + t.suspension * 0.012,
    steerRate: 3.4 + t.suspension * 0.5,
    // Sztywność boczna opon [N/rad]
    corneringFront: 75000 + t.grip * 4200,
    corneringRear: 80000 + t.grip * 4600 - t.drift * 5200,
    // Współczynnik przyczepności (tylne opony słabsze po ustawieniu driftowym)
    muFront: 1.18 + t.grip * 0.045,
    muRear: 1.3 + t.grip * 0.05 - t.drift * 0.075,
    yawDamping: 1000 + t.suspension * 80,
    dragCoeff: 0.42,
    rollingResistance: 175,
  };
}

export function createCar(x = 0, z = 0, yaw = 0) {
  return {
    x, z, yaw, vx: 0, vz: 0, yawRate: 0, nitro: 100,
    speed: 0, driftAngle: 0, boost: false, gear: 1,
    steerAngle: 0, lateralAccel: 0,
  };
}

/**
 * Krok fizyki — uproszczony model rowerowy z kątami poślizgu opon.
 * Wewnętrzny układ: x przód, y lewo, obrót przeciwnie do ruchu wskazówek zegara.
 * Sterowanie `steer > 0` oznacza skręt w prawo (zgodnie z interfejsem gry).
 * Mutuje `car`; zwraca dodatkowe informacje o poślizgu.
 */
export function stepCar(car, input, params, dt) {
  dt = clamp(dt, 0, 0.05);
  const throttle = clamp(input.throttle || 0, 0, 1);
  const brake = clamp(input.brake || 0, 0, 1);
  const steer = clamp(input.steer || 0, -1, 1);
  const handbrake = !!input.handbrake;

  car.boost = !!input.nitro && car.nitro > 0 && throttle > 0.1;
  if (car.boost) car.nitro = Math.max(0, car.nitro - 32 * dt);
  else car.nitro = Math.min(100, car.nitro + 5 * dt);

  // Współrzędne ciała: przód i lewo (standardowy układ pojazdu).
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  const lx = -Math.cos(car.yaw), lz = Math.sin(car.yaw);
  const vf = car.vx * fx + car.vz * fz;
  const vy = car.vx * lx + car.vz * lz;
  const r = -car.yawRate; // r > 0 = skręt w lewo

  // Kierownica: przód skręca w lewo dla ujemnego steer (bo steer > 0 to prawo).
  const speed = Math.abs(vf);
  const steerLimit = params.steerMax / (1 + speed * speed * 0.0012);
  const targetDelta = -steer * steerLimit;
  car.steerAngle = smooth(car.steerAngle, targetDelta, params.steerRate, dt);

  // Napęd / hamowanie / opór
  const topSpeed = params.maxSpeed + (car.boost ? 8 : 0);
  const powerCurve = Math.max(0, 1 - (speed / topSpeed) ** 2);
  let driveForce = throttle * (params.engineForce + (car.boost ? params.boostForce : 0)) * powerCurve;
  if (brake > 0 && vf < 0.3 && throttle < 0.1) driveForce = -params.reverseForce * brake;
  let frontBrake = 0, rearBrake = 0;
  if (brake > 0 && vf > 0.3) {
    frontBrake = -params.brakeForce * brake * 0.62;
    rearBrake = -params.brakeForce * brake * 0.38;
  }
  if (handbrake) rearBrake -= params.brakeForce * 0.35;
  const drag = -params.dragCoeff * vf * speed - Math.sign(vf) * params.rollingResistance;
  const fxTotal = driveForce + frontBrake + rearBrake * 0.4 + drag;
  const rearLong = rearBrake * 0.6 + driveForce;

  const longAccel = clamp(fxTotal / params.mass, -12, 12);
  // Przenoszenie masy: hamowanie obciąża przód, przyspieszenie — tył.
  const loadTotal = params.mass * params.gravity;
  const wheelbase = params.a + params.b;
  let frontLoad = loadTotal * params.b / wheelbase - params.mass * longAccel * params.cgHeight / wheelbase;
  frontLoad = clamp(frontLoad, loadTotal * 0.16, loadTotal * 0.84);
  const rearLoad = loadTotal - frontLoad;
  const lateralTransfer = clamp(Math.abs(car.lateralAccel) / params.gravity, 0, 1.4);
  const frontMu = params.muFront * (1 - 0.12 * lateralTransfer);
  const rearMu = params.muRear * (handbrake ? 0.55 : 1) * (1 - 0.16 * lateralTransfer);

  // Kąty poślizgu i siły boczne opon
  const vSafe = Math.max(2.2, speed);
  const alphaF = Math.atan2(vy + params.a * r, vSafe) - car.steerAngle;
  const alphaR = Math.atan2(vy - params.b * r, vSafe);
  const lowSpeedGrip = clamp(speed / 3, 0, 1);
  const frontCapacity = Math.max(1, frontMu * frontLoad);
  const rearCapacity = Math.max(1, rearMu * rearLoad);
  // Koło przyczepności: longitudinalna siła (gaz/hamulec) zabiera część przyczepności bocznej.
  const frontCircle = Math.sqrt(Math.max(0, 1 - (Math.abs(frontBrake) / frontCapacity) ** 2));
  const rearCircle = Math.sqrt(Math.max(0, 1 - (Math.min(Math.abs(rearLong), rearCapacity) / rearCapacity) ** 2));
  // Krzywa opony: siła rośnie do szczytu przy ~8° poślizgu, potem maleje.
  // Dzięki temu counter-sterowanie realnie ratuje auto przed spinningiem.
  const tireCurve = (alpha, peak) => {
    const s = alpha / peak;
    return (2 * s) / (1 + s * s);
  };
  const frontPeak = 0.14 * (75000 / params.corneringFront);
  const rearPeak = 0.14 * (80000 / params.corneringRear);
  let fyFront = -frontCapacity * tireCurve(alphaF, frontPeak) * frontCircle * lowSpeedGrip;
  let fyRear = -rearCapacity * tireCurve(alphaR, rearPeak) * rearCircle * lowSpeedGrip;

  const latAccel = clamp((fyFront + fyRear) / params.mass, -params.gravity * 1.8, params.gravity * 1.8);
  let rAccel = (params.a * fyFront - params.b * fyRear - params.yawDamping * r) / params.inertia;
  rAccel = clamp(rAccel, -9, 9);

  // Całkowanie w układzie świata
  const axWorld = (fxTotal / params.mass) * fx + latAccel * lx;
  const azWorld = (fxTotal / params.mass) * fz + latAccel * lz;
  car.vx += axWorld * dt;
  car.vz += azWorld * dt;
  const newR = r + rAccel * dt;
  car.yawRate = clamp(-newR, -2.6, 2.6);
  car.yaw += car.yawRate * dt;
  car.x += car.vx * dt;
  car.z += car.vz * dt;
  car.lateralAccel = latAccel;

  const nfx = Math.sin(car.yaw), nfz = Math.cos(car.yaw);
  const nrx = Math.cos(car.yaw), nrz = -Math.sin(car.yaw);
  const bodyForward = car.vx * nfx + car.vz * nfz;
  const bodyRight = car.vx * nrx + car.vz * nrz;
  car.speed = Math.hypot(car.vx, car.vz);
  car.driftAngle = Math.atan2(bodyRight, Math.abs(bodyForward) + 0.5) * 180 / Math.PI;
  car.gear = bodyForward < -0.5 ? -1 : clamp(Math.floor(Math.abs(bodyForward) / 9) + 1, 1, 6);
  return { speed: car.speed, driftAngle: car.driftAngle, rearSlip: Math.abs(bodyRight), throttle, braking: brake > 0 };
}

/** Odbicie od krawędzi trasy: spycha auto do środka i tnie prędkość. */
export function resolveTrackBounds(car, proj, halfWidth) {
  const limit = halfWidth - 1.4;
  if (proj.dist <= limit) return false;
  const nx = (proj.x - car.x) / (proj.dist || 1);
  const nz = (proj.z - car.z) / (proj.dist || 1);
  car.x += nx * (proj.dist - limit);
  car.z += nz * (proj.dist - limit);
  const into = car.vx * -nx + car.vz * -nz;
  if (into > 0) {
    car.vx += nx * into * 1.35;
    car.vz += nz * into * 1.35;
  }
  car.vx *= 0.86;
  car.vz *= 0.86;
  return true;
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const c = Math.floor((seconds % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

/** Punkty za poślizg w danym kroku (tylko przy odpowiedniej prędkości i kącie). */
export function driftPoints(speedKmh, angle, dt) {
  const a = Math.abs(angle);
  if (speedKmh < 28 || a < 14 || a > 80) return 0;
  const quality = clamp(1 - Math.abs(a - 38) / 55, 0.2, 1);
  return Math.round((speedKmh / 3.6) * quality * 9 * dt);
}
