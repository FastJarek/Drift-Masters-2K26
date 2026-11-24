import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SAVE, TRACKS, sanitizeSave, sampleClosedPath, nearestOnPath,
  buildCheckpoints, trackLength, medalFor, carParams, createCar, stepCar,
  resolveTrackBounds, driftPoints, formatTime, upgradeCost,
} from '../src/core.js';

test('sanitizeSave uzupełnia brakujące pola i ogranicza wartości', () => {
  const s = sanitizeSave({ settings: { sensitivity: 99, graphics: ' dziwne ', controlMode: 'x' }, tuning: { engine: 99 }, credits: -5 });
  assert.equal(s.settings.sensitivity, 2);
  assert.equal(s.settings.graphics, 'high');
  assert.equal(s.settings.controlMode, 'touch');
  assert.equal(s.tuning.engine, 5);
  assert.equal(s.credits, 0);
  assert.deepEqual(sanitizeSave(null), DEFAULT_SAVE);
});

test('wszystkie trasy mają poprawną pętlę i punkty kontrolne', () => {
  assert.equal(TRACKS.length, 6);
  assert.equal(TRACKS.filter((t) => t.type === 'trening').length, 3);
  assert.equal(TRACKS.filter((t) => t.type === 'zawody').length, 3);
  for (const t of TRACKS) {
    const path = sampleClosedPath(t.points);
    assert.equal(path.length, t.points.length * 14);
    assert.ok(trackLength(path) > 100, `${t.id} jest za krótka`);
    const cps = buildCheckpoints(path, t.checkpoints);
    assert.equal(cps.length, t.checkpoints);
    for (const cp of cps) assert.ok(Number.isFinite(cp.yaw));
  }
});

test('nearestOnPath znajduje odległość i styczną', () => {
  const path = [{ x: 0, z: 0 }, { x: 0, z: 10 }, { x: 10, z: 10 }, { x: 10, z: 0 }];
  const p = nearestOnPath(path, 3, 10);
  assert.ok(Math.abs(p.dist - 0) < 1e-6);
  assert.ok(p.tx > 0.99 || p.tz > 0.99);
  const far = nearestOnPath(path, 30, 30);
  assert.ok(far.dist > 14);
});

test('samochód przyspiesza, hamuje i jeździ wstecz', () => {
  const params = carParams(DEFAULT_SAVE.tuning);
  const car = createCar(0, 0, 0);
  const input = { throttle: 1, brake: 0, steer: 0 };
  for (let i = 0; i < 120; i++) stepCar(car, input, params, 1 / 60);
  assert.ok(car.speed > 10, `prędkość=${car.speed}`);
  assert.ok(car.z > 0, 'samochód powinien jechać w kierunku +Z');
  for (let i = 0; i < 60; i++) stepCar(car, { throttle: 0, brake: 1, steer: 0 }, params, 1 / 60);
  assert.ok(car.speed < 6);
  for (let i = 0; i < 180; i++) stepCar(car, { throttle: 0, brake: 1, steer: 0 }, params, 1 / 60);
  assert.ok(car.vz < -1, 'po zatrzymaniu wlecze bieg wsteczny');
  assert.equal(car.gear, -1);
});

test('hamulec ręczny zwiększa kąt poślizgu', () => {
  const params = carParams({ ...DEFAULT_SAVE.tuning, drift: 3 });
  const drive = (handbrake) => {
    const car = createCar(0, 0, 0);
    for (let i = 0; i < 90; i++) stepCar(car, { throttle: 1, brake: 0, steer: 0 }, params, 1 / 60);
    let max = 0;
    for (let i = 0; i < 90; i++) {
      stepCar(car, { throttle: 0.6, brake: 0, steer: 1, handbrake }, params, 1 / 60);
      max = Math.max(max, Math.abs(car.driftAngle));
    }
    return max;
  };
  assert.ok(drive(true) > drive(false) + 3);
});

test('punkty driftu tylko przy odpowiedniej prędkości i kącie', () => {
  assert.equal(driftPoints(40, 5, 1), 0);
  assert.equal(driftPoints(10, 35, 1), 0);
  assert.equal(driftPoints(90, 85, 1), 0);
  assert.ok(driftPoints(90, 35, 1 / 60) > 0);
});

test('odbicie od krawędzi trasy nie wypycha auta poza limit', () => {
  const car = createCar(15, 0, Math.PI / 2);
  car.vx = 12;
  const hit = resolveTrackBounds(car, { dist: 15, x: 0, z: 0 }, 10);
  assert.equal(hit, true);
  assert.ok(Math.hypot(car.x, car.z) <= 10);
  assert.ok(car.vx < 12);
});

test('medale i formatowanie czasu', () => {
  const t = TRACKS[0];
  assert.equal(medalFor(t, t.medals.gold - 1), 'gold');
  assert.equal(medalFor(t, t.medals.gold + 1), 'silver');
  assert.equal(medalFor(t, t.medals.bronze + 1), 'none');
  assert.equal(formatTime(65.43), '01:05.43');
  assert.equal(upgradeCost(2), 1100);
});
