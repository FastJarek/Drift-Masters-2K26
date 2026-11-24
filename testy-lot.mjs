// Testy warstwy fizyki – uruchom: node testy-lot.mjs
import assert from "node:assert/strict";
import { FizykaLotu, K } from "./fizyka-lotu.mjs";

const krok = (f, sekundy, ster) => {
  for (let i = 0; i < Math.round(sekundy * 60); i++) f.krok(1 / 60, ster);
};

// 1. Start i oderwanie się od ziemi.
const start = new FizykaLotu();
krok(start, 6, { throttle: 1 });
assert.ok(start.predkoscWartosc > 40, "samolot powinien przyspieszyć na pasie");
assert.equal(start.naZiemi, true, "na początku powinien jechać po ziemi");
krok(start, 3, { throttle: 1, pitch: 0.4 });
assert.ok(start.wysokosc > 20, "samolot powinien wystartować");
console.log("✓ start i oderwanie od ziemi");

// 2. Przeciągnięcie przy zbyt dużym kącie natarcia.
const stall = new FizykaLotu();
stall.pozycja.y = 500;
stall.naZiemi = false;
stall.byloWSzpowietrzu = true;
stall.predkosc = { x: 0, y: 0, z: -22 };
krok(stall, 2, { throttle: 0.2, pitch: 1 });
assert.equal(stall.stall, true, "powinien pojawić się sygnał przeciągnięcia");
console.log("✓ wykrywanie przeciągnięcia");

// 3. Paliwo i gaśnięcie silnika w powietrzu.
const paliwo = new FizykaLotu();
paliwo.pozycja.y = 400;
paliwo.naZiemi = false;
paliwo.byloWSzpowietrzu = true;
krok(paliwo, 400, { throttle: 1 });
assert.equal(paliwo.fuel, 0);
assert.equal(paliwo.engineOn, false);
console.log("✓ zużycie paliwa i gaśnięcie silnika");

// 4. Twarde lądowanie kończy się crash i automatycznym resetem.
const crash = new FizykaLotu();
crash.pozycja.y = 3;
crash.predkosc.y = -14;
krok(crash, 0.3, {});
assert.equal(crash.crashed, true);
krok(crash, 3, {});
assert.equal(crash.crashed, false);
assert.equal(crash.fuel, K.POJEMNOSC_PALIWA);
console.log("✓ twarde lądowanie, crash i reset");

// 5. Tankowanie po zatrzymaniu na ziemi.
const tank = new FizykaLotu();
tank.fuel = 12;
krok(tank, 3, { throttle: 0, brakes: true });
assert.equal(tank.fuel, K.POJEMNOSC_PALIWA);
console.log("✓ tankowanie na ziemi");

// 6. Nie można schować podwozia na ziemi.
const gear = new FizykaLotu();
gear.krok(1 / 60, { gear: false });
assert.equal(gear.gear, true);
console.log("✓ blokada podwozia na ziemi");

// 7. Autopilot startuje, leci po trasie i ją kończy.
const ap = new FizykaLotu();
ap.dodajPunkt(250, 0);
ap.dodajPunkt(-200, -150);
assert.equal(ap.ustawAutopilot(true), true);
krok(ap, 55, {});
assert.equal(ap.crashed, false, "autopilot nie powinien rozbić samolotu");
assert.equal(ap.autopilot, false, "autopilot powinien zakończyć trasę");
assert.equal(ap.celIndex, ap.waypoints.length);
assert.ok(ap.wysokosc > 50, "samolot powinien pozostać w powietrzu");
console.log("✓ autopilot i wyznaczanie trasy");

console.log("\nWszystkie testy fizyki przeszły pomyślnie.");
