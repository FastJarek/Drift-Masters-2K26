// Samoloty 3D – rendering Three.js, HUD, minimapa i sterowanie klawiaturą.

import * as THREE from "three";
import { FizykaLotu, K } from "./fizyka-lotu.mjs";

const canvas = document.getElementById("gra-samolot");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(960, 600, false);

const scena = new THREE.Scene();
scena.background = new THREE.Color(0x9ec9e8);
scena.fog = new THREE.Fog(0x9ec9e8, 900, 2600);

const kamera = new THREE.PerspectiveCamera(68, 960 / 600, 0.05, 5000);
kamera.position.set(0, 9, 195);

scena.add(new THREE.HemisphereLight(0xffffff, 0x4d7d52, 1.25));
const slonce = new THREE.DirectionalLight(0xffffff, 1.5);
slonce.position.set(400, 800, 300);
scena.add(slonce);

const f = new FizykaLotu();

// --- Świato: teren, lotnisko, drzewa --------------------------------------

const ziemia = new THREE.Mesh(
  new THREE.PlaneGeometry(6000, 6000),
  new THREE.MeshLambertMaterial({ color: 0x4d8b52 })
);
ziemia.rotation.x = -Math.PI / 2;
ziemia.position.y = -0.05;
scena.add(ziemia);

const siatka = new THREE.GridHelper(6000, 60, 0x3d6f43, 0x3d6f43);
siatka.position.y = 0.02;
siatka.material.transparent = true;
siatka.material.opacity = 0.35;
scena.add(siatka);

const pas = new THREE.Mesh(
  new THREE.PlaneGeometry(K.SZEROKOSC_PASA, K.DLUGOSC_PASA),
  new THREE.MeshLambertMaterial({ color: 0x34383d })
);
pas.rotation.x = -Math.PI / 2;
pas.position.y = 0.06;
scena.add(pas);

const materialLinii = new THREE.MeshLambertMaterial({ color: 0xf0f0e8 });
for (let z = -190; z <= 190; z += 16) {
  const kreska = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 8), materialLinii);
  kreska.position.set(0, 0.09, z);
  scena.add(kreska);
}
for (const x of [-K.SZEROKOSC_PASA / 2 + 0.4, K.SZEROKOSC_PASA / 2 - 0.4]) {
  const krawedz = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, K.DLUGOSC_PASA), materialLinii);
  krawedz.position.set(x, 0.09, 0);
  scena.add(krawedz);
}
for (const z of [-188, 188]) {
  for (let i = -3; i <= 3; i++) {
    const próg = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 5), materialLinii);
    próg.position.set(i * 4.5, 0.09, z);
    scena.add(próg);
  }
}

const terminal = new THREE.Mesh(
  new THREE.BoxGeometry(45, 14, 24),
  new THREE.MeshLambertMaterial({ color: 0x9aa6ae })
);
terminal.position.set(75, 7, 40);
scena.add(terminal);

let seed = 987654321;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

const materialDrzewa = new THREE.MeshLambertMaterial({ color: 0x2f6b3c });
for (let i = 0; i < 90; i++) {
  const x = (rand() - 0.5) * 3000;
  const z = (rand() - 0.5) * 3000;
  if (Math.abs(x) < 70 && Math.abs(z) < 280) continue;
  const h = 22 + rand() * 26;
  const drzewo = new THREE.Mesh(new THREE.ConeGeometry(7 + rand() * 5, h, 6), materialDrzewa);
  drzewo.position.set(x, h / 2, z);
  scena.add(drzewo);
}

const materialGor = new THREE.MeshLambertMaterial({ color: 0x6f8a99 });
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2;
  const h = 280 + rand() * 320;
  const gora = new THREE.Mesh(new THREE.ConeGeometry(260 + rand() * 180, h, 5), materialGor);
  gora.position.set(Math.cos(a) * 2600, h / 2 - 40, Math.sin(a) * 2600);
  scena.add(gora);
}

// --- Model samolotu --------------------------------------------------------

function zbudujSamolot() {
  const grupa = new THREE.Group();
  const korpus = new THREE.MeshLambertMaterial({ color: 0xe8edf2 });
  const akcent = new THREE.MeshLambertMaterial({ color: 0x2e8bd6 });
  const ciemny = new THREE.MeshLambertMaterial({ color: 0x1c2833 });

  const kadlub = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.9, 8, 14), korpus);
  kadlub.rotation.x = Math.PI / 2;
  kadlub.position.y = 1.25;
  grupa.add(kadlub);

  const nos = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.8, 14), akcent);
  nos.rotation.x = -Math.PI / 2;
  nos.position.set(0, 1.25, -4.9);
  grupa.add(nos);

  const skrzydla = new THREE.Mesh(new THREE.BoxGeometry(11, 0.22, 1.9), korpus);
  skrzydla.position.set(0, 1.05, 0);
  grupa.add(skrzydla);

  const klapy = [];
  for (const x of [-2.8, 2.8]) {
    const klapa = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 0.7), akcent);
    klapa.position.set(x, 1.02, 1.15);
    grupa.add(klapa);
    klapy.push(klapa);
  }

  const statecznik = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 1.2), korpus);
  statecznik.position.set(0, 1.45, 3.6);
  grupa.add(statecznik);

  const sterPionowy = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.9, 1.5), akcent);
  sterPionowy.position.set(0, 2.3, 3.7);
  grupa.add(sterPionowy);

  const kabina = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), ciemny);
  kabina.scale.set(1, 0.75, 1.5);
  kabina.position.set(0, 1.85, -2);
  grupa.add(kabina);

  const smiglo = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const lopata = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.12), ciemny);
    lopata.rotation.z = i * Math.PI / 2;
    smiglo.add(lopata);
  }
  smiglo.position.set(0, 1.25, -5.85);
  grupa.add(smiglo);

  const podwozie = new THREE.Group();
  const koloGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.2, 12);
  for (const [x, z] of [[0, -3.4], [-1.7, 1.1], [1.7, 1.1]]) {
    const kolo = new THREE.Mesh(koloGeo, ciemny);
    kolo.rotation.z = Math.PI / 2;
    kolo.position.set(x, 0.45, z);
    podwozie.add(kolo);
  }
  grupa.add(podwozie);

  return { grupa, smiglo, podwozie, klapy };
}

const samolot = zbudujSamolot();
scena.add(samolot.grupa);

// --- Trasa i markery w 3D --------------------------------------------------

const trasaGrafika = new THREE.Group();
scena.add(trasaGrafika);

function wyczysc(obiekt) {
  obiekt.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  obiekt.clear();
}

function odswiezTrase() {
  wyczysc(trasaGrafika);
  const punkty = f.waypoints;
  if (punkty.length === 0) return;

  if (punkty.length > 1) {
    const gora = punkty.map((p) => new THREE.Vector3(p.x, p.alt, p.z));
    const dol = punkty.map((p) => new THREE.Vector3(p.x, 2, p.z));
    trasaGrafika.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(gora),
        new THREE.LineBasicMaterial({ color: 0xffd34d })
      )
    );
    trasaGrafika.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(dol),
        new THREE.LineBasicMaterial({ color: 0xbcd47a, transparent: true, opacity: 0.5 })
      )
    );
  }

  punkty.forEach((p, i) => {
    const kolor = i === f.celIndex ? 0xffc23d : 0xf2e68b;
    const material = new THREE.MeshBasicMaterial({ color: kolor });
    const pierscien = new THREE.Mesh(new THREE.TorusGeometry(12, 0.9, 8, 28), material);
    pierscien.rotation.x = -Math.PI / 2;
    pierscien.position.set(p.x, p.alt, p.z);
    trasaGrafika.add(pierscien);

    const slup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, p.alt, 6),
      new THREE.MeshBasicMaterial({ color: kolor, transparent: true, opacity: 0.45 })
    );
    slup.position.set(p.x, p.alt / 2, p.z);
    trasaGrafika.add(slup);
  });
}

let ostatniaLiczbaPunktow = -1;
let ostatniCel = -1;

// --- HUD i minimapa --------------------------------------------------------

const el = (id) => document.getElementById(id);
const hud = {
  predkosc: el("hud-predkosc"),
  wysokosc: el("hud-wysokosc"),
  pion: el("hud-pion"),
  kurs: el("hud-kurs"),
  paliwo: el("hud-paliwo"),
  pasek: el("paliwo-pasek"),
  gaz: el("hud-gaz"),
  podwozie: el("hud-podwozie"),
  klapy: el("hud-klapy"),
  ap: el("hud-ap"),
  cel: el("hud-cel"),
  stall: el("hud-stall"),
  komunikat: el("hud-komunikat"),
  pomoc: el("pomoc"),
  btnAp: el("btn-ap"),
};

function aktualizujHud() {
  hud.predkosc.textContent = f.predkoscKmh.toFixed(0);
  hud.wysokosc.textContent = f.wysokosc.toFixed(0);
  hud.pion.textContent = f.verticalSpeed.toFixed(1);
  hud.kurs.textContent = String(Math.round(f.headingStopnie)).padStart(3, "0");
  hud.paliwo.textContent = f.fuel.toFixed(0);
  hud.pasek.style.width = `${Math.max(0, f.fuel)}%`;
  hud.pasek.style.background = f.fuel < 20 ? "#ff5a52" : "#59d77a";
  hud.gaz.textContent = Math.round(f.throttle * 100);
  hud.podwozie.textContent = f.gear ? "WY" : "SCH";
  hud.klapy.textContent = f.flaps ? "WY" : "SCH";
  hud.ap.textContent = f.autopilot ? "ON" : "OFF";
  hud.btnAp.classList.toggle("aktywny", f.autopilot);
  hud.stall.classList.toggle("widoczne", f.stall && !f.naZiemi);
  hud.komunikat.textContent = f.komunikat;

  const cel = f.waypoints[f.celIndex];
  if (cel) {
    const d = Math.hypot(cel.x - f.pozycja.x, cel.z - f.pozycja.z);
    hud.cel.textContent = `#${f.celIndex + 1} · ${d.toFixed(0)} m`;
  } else {
    hud.cel.textContent = f.waypoints.length ? "–" : "brak trasy";
  }
}

const mini = el("minimapa");
const mctx = mini.getContext("2d");
const ROZMIAR_MINI = 210;
const ZASIEG_MINI = 800;
const skalaMini = ROZMIAR_MINI / (2 * ZASIEG_MINI);

function rysujMinimape() {
  const s = ROZMIAR_MINI;
  const c = s / 2;
  const px = (x) => c + x * skalaMini;
  const py = (z) => c + z * skalaMini;

  mctx.fillStyle = "#1d3323";
  mctx.fillRect(0, 0, s, s);

  mctx.strokeStyle = "rgba(150, 200, 160, 0.18)";
  mctx.lineWidth = 1;
  for (let v = -ZASIEG_MINI; v <= ZASIEG_MINI; v += 200) {
    mctx.beginPath();
    mctx.moveTo(px(v), 0);
    mctx.lineTo(px(v), s);
    mctx.moveTo(0, py(v));
    mctx.lineTo(s, py(v));
    mctx.stroke();
  }

  mctx.fillStyle = "#71787e";
  mctx.fillRect(
    px(-K.SZEROKOSC_PASA / 2),
    py(-K.DLUGOSC_PASA / 2),
    K.SZEROKOSC_PASA * skalaMini,
    K.DLUGOSC_PASA * skalaMini
  );

  mctx.fillStyle = "#59d77a";
  mctx.beginPath();
  mctx.arc(px(0), py(170), 3, 0, Math.PI * 2);
  mctx.fill();

  if (f.waypoints.length) {
    mctx.strokeStyle = "#ffd34d";
    mctx.lineWidth = 1.5;
    mctx.beginPath();
    f.waypoints.forEach((p, i) => {
      if (i === 0) mctx.moveTo(px(p.x), py(p.z));
      else mctx.lineTo(px(p.x), py(p.z));
    });
    mctx.stroke();

    f.waypoints.forEach((p, i) => {
      mctx.fillStyle = i === f.celIndex ? "#ff9f1c" : "#ffd34d";
      mctx.beginPath();
      mctx.arc(px(p.x), py(p.z), 4, 0, Math.PI * 2);
      mctx.fill();
      mctx.fillStyle = "#1d1d1d";
      mctx.font = "bold 9px sans-serif";
      mctx.fillText(String(i + 1), px(p.x) - 2.5, py(p.z) + 3);
    });
  }

  mctx.save();
  mctx.translate(px(f.pozycja.x), py(f.pozycja.z));
  mctx.rotate(f.heading);
  mctx.fillStyle = "#ffffff";
  mctx.beginPath();
  mctx.moveTo(0, -7);
  mctx.lineTo(5, 6);
  mctx.lineTo(-5, 6);
  mctx.closePath();
  mctx.fill();
  mctx.restore();
}

function pozycjaZKliku(e) {
  const rect = mini.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) / rect.width) * ROZMIAR_MINI;
  const my = ((e.clientY - rect.top) / rect.height) * ROZMIAR_MINI;
  return {
    x: (mx - ROZMIAR_MINI / 2) / skalaMini,
    z: (my - ROZMIAR_MINI / 2) / skalaMini,
  };
}

mini.addEventListener("click", (e) => {
  const p = pozycjaZKliku(e);
  f.dodajPunkt(p.x, p.z);
});
mini.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  f.usunOstatniPunkt();
});

// --- Sterowanie ------------------------------------------------------------

const wcisniete = new Set();
const przelaczniki = new Set(["KeyG", "KeyF", "KeyC", "KeyP", "KeyR", "KeyH"]);
let gearCmd = true;
let flapsCmd = false;
let trybKamery = 0;

function reset() {
  f.reset();
  gearCmd = true;
  flapsCmd = false;
  wcisniete.clear();
}

function toggleHelp() {
  hud.pomoc.classList.toggle("ukryta");
}

window.addEventListener("keydown", (e) => {
  if (!wcisniete.has(e.code) && przelaczniki.has(e.code)) {
    if (e.code === "KeyG") gearCmd = !gearCmd;
    if (e.code === "KeyF") flapsCmd = !flapsCmd;
    if (e.code === "KeyC") trybKamery = (trybKamery + 1) % 2;
    if (e.code === "KeyP") f.ustawAutopilot(!f.autopilot);
    if (e.code === "KeyR") reset();
    if (e.code === "KeyH") toggleHelp();
  }
  wcisniete.add(e.code);
  if (["Space", "KeyW", "KeyS", "KeyA", "KeyD"].includes(e.code)) e.preventDefault();
});
window.addEventListener("keyup", (e) => wcisniete.delete(e.code));
window.addEventListener("blur", () => wcisniete.clear());

el("btn-ap").addEventListener("click", () => f.ustawAutopilot(!f.autopilot));
el("btn-clear").addEventListener("click", () => f.wyczyscTrase());
el("btn-undo").addEventListener("click", () => f.usunOstatniPunkt());
el("btn-camera").addEventListener("click", () => {
  trybKamery = (trybKamery + 1) % 2;
});
el("btn-reset").addEventListener("click", reset);
el("btn-help").addEventListener("click", toggleHelp);

// --- Pętla główna ----------------------------------------------------------

const wektor = (v) => new THREE.Vector3(v.x, v.y, v.z);
const baza = new THREE.Matrix4();
let poprzedniCzas = 0;

function petla(czas) {
  const dt = poprzedniCzas ? Math.min(0.05, (czas - poprzedniCzas) / 1000) : 0;
  poprzedniCzas = czas;

  const ster = {
    pitch: (wcisniete.has("KeyS") ? 1 : 0) - (wcisniete.has("KeyW") ? 1 : 0),
    roll: (wcisniete.has("KeyD") ? 1 : 0) - (wcisniete.has("KeyA") ? 1 : 0),
    yaw: (wcisniete.has("KeyE") ? 1 : 0) - (wcisniete.has("KeyQ") ? 1 : 0),
    brakes: wcisniete.has("Space"),
    throttle: f.throttle,
    gear: gearCmd,
    flaps: flapsCmd,
  };
  if (wcisniete.has("ShiftLeft") || wcisniete.has("ShiftRight")) {
    ster.throttle += 0.55 * dt;
  }
  if (wcisniete.has("ControlLeft") || wcisniete.has("ControlRight")) {
    ster.throttle -= 0.7 * dt;
  }

  f.krok(dt, ster);

  if (f.waypoints.length !== ostatniaLiczbaPunktow || f.celIndex !== ostatniCel) {
    odswiezTrase();
    ostatniaLiczbaPunktow = f.waypoints.length;
    ostatniCel = f.celIndex;
  }

  const forward = wektor(f.wektorForward);
  const up = wektor(f.wektorUp);
  const right = wektor(f.wektorRight);
  const pozycja = wektor(f.pozycja);

  baza.makeBasis(right, up, forward.clone().negate());
  samolot.grupa.quaternion.setFromRotationMatrix(baza);
  samolot.grupa.position.copy(pozycja);
  samolot.smiglo.rotation.z = f.obrityProp;
  samolot.podwozie.visible = f.gear;
  samolot.klapy.forEach((klapa) => {
    klapa.rotation.x = f.flaps ? -0.35 : 0;
  });

  if (trybKamery === 0) {
    const cel = pozycja.clone().addScaledVector(forward, -18).addScaledVector(up, 6);
    kamera.position.lerp(cel, Math.min(1, dt * 3));
    kamera.up.set(0, 1, 0);
    kamera.lookAt(pozycja.clone().addScaledVector(forward, 12));
  } else {
    const lokal = new THREE.Vector3(0, 1.9, -2.4).applyQuaternion(samolot.grupa.quaternion);
    kamera.position.copy(pozycja).add(lokal);
    kamera.up.copy(up);
    kamera.lookAt(kamera.position.clone().addScaledVector(forward, 100));
  }

  aktualizujHud();
  rysujMinimape();
  renderer.render(scena, kamera);
  requestAnimationFrame(petla);
}

requestAnimationFrame(petla);

// Ułatwiatesty w konsoli przeglądarki.
window.lot = f;
