// Wersja 3D gry „Omijaj przeszkody” – rendering i sterowanie w Three.js.

import * as THREE from "three";
import { K, Gra3D } from "./logika3d.mjs";

const canvas = document.getElementById("gra");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(480, 720, false);

const scena = new THREE.Scene();
scena.background = new THREE.Color(0x9fd8ff);
scena.fog = new THREE.Fog(0x9fd8ff, 28, 72);

const kamera = new THREE.PerspectiveCamera(65, 480 / 720, 0.1, 200);
kamera.position.set(0, 4.4, 8.5);
kamera.lookAt(0, 0.8, -12);

scena.add(new THREE.HemisphereLight(0xffffff, 0x3f7b45, 1.3));
const swiatlo = new THREE.DirectionalLight(0xffffff, 1.4);
swiatlo.position.set(6, 12, 6);
scena.add(swiatlo);

const gra = new Gra3D();
const elementyRuchome = [];

function dodajRuchomy(mesh) {
  scena.add(mesh);
  elementyRuchome.push(mesh);
}

function zbudujSrodowisko() {
  const trawa = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ color: 0x3a7d44 })
  );
  trawa.rotation.x = -Math.PI / 2;
  trawa.position.set(0, -0.03, -80);
  scena.add(trawa);

  const droga = new THREE.Mesh(
    new THREE.PlaneGeometry(K.DROGA_SZER, 220),
    new THREE.MeshLambertMaterial({ color: 0x3a3a3e })
  );
  droga.rotation.x = -Math.PI / 2;
  droga.position.set(0, 0, -90);
  scena.add(droga);

  const materialKrawedzi = new THREE.MeshLambertMaterial({ color: 0xebebe1 });
  for (const x of [-K.POL_DROGI + 0.05, K.POL_DROGI - 0.05]) {
    const krawedz = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.02, 220),
      materialKrawedzi
    );
    krawedz.position.set(x, 0.02, -90);
    scena.add(krawedz);
  }

  const materialLinii = new THREE.MeshLambertMaterial({ color: 0xebebe1 });
  for (const x of [-K.SZEROKOSC_PASA / 2, K.SZEROKOSC_PASA / 2]) {
    for (let z = -90; z <= 10; z += 4) {
      const linia = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.02, 1.6),
        materialLinii
      );
      linia.position.set(x, 0.025, z);
      dodajRuchomy(linia);
    }
  }

  const materialTrawy = new THREE.MeshLambertMaterial({ color: 0x316a3a });
  for (const x of [-8, 8]) {
    for (let z = -90; z <= 10; z += 6) {
      const plama = new THREE.Mesh(
        new THREE.BoxGeometry(5, 0.02, 3),
        materialTrawy
      );
      plama.position.set(x, 0.01, z);
      dodajRuchomy(plama);
    }
  }
}

function stworzAuto(kolor, kierunek) {
  const grupa = new THREE.Group();

  const karoseria = new THREE.Mesh(
    new THREE.BoxGeometry(K.AUTO_SZER, 0.5, K.AUTO_DL),
    new THREE.MeshLambertMaterial({ color: kolor })
  );
  karoseria.position.y = 0.45;
  grupa.add(karoseria);

  const kabina = new THREE.Mesh(
    new THREE.BoxGeometry(K.AUTO_SZER * 0.82, 0.42, K.AUTO_DL * 0.52),
    new THREE.MeshLambertMaterial({
      color: new THREE.Color(kolor).multiplyScalar(0.62),
    })
  );
  kabina.position.set(0, 0.88, 0.22 * kierunek);
  grupa.add(kabina);

  const koloGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.16, 12);
  const koloMat = new THREE.MeshLambertMaterial({ color: 0x1b1b1b });
  for (const x of [-K.AUTO_SZER / 2, K.AUTO_SZER / 2]) {
    for (const z of [-K.AUTO_DL * 0.3, K.AUTO_DL * 0.3]) {
      const kolo = new THREE.Mesh(koloGeo, koloMat);
      kolo.rotation.z = Math.PI / 2;
      kolo.position.set(x, 0.25, z);
      grupa.add(kolo);
    }
  }

  const cien = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 20),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    })
  );
  cien.rotation.x = -Math.PI / 2;
  cien.position.y = 0.012;
  cien.scale.set(1, 1.25, 1);
  grupa.add(cien);

  return grupa;
}

function usunGrupe(grupa) {
  scena.remove(grupa);
  grupa.traverse((obiekt) => {
    if (obiekt.geometry) obiekt.geometry.dispose();
    if (obiekt.material) obiekt.material.dispose();
  });
}

zbudujSrodowisko();

const graczWizual = stworzAuto(0x3cdc50, -1);
scena.add(graczWizual);
const wizualneNpc = new Map();

function synchronizujNpc() {
  const aktywne = new Set(gra.npc.map((auto) => auto.id));
  for (const [id, grupa] of wizualneNpc) {
    if (!aktywne.has(id)) {
      usunGrupe(grupa);
      wizualneNpc.delete(id);
    }
  }
  for (const auto of gra.npc) {
    let grupa = wizualneNpc.get(auto.id);
    if (!grupa) {
      grupa = stworzAuto(0xe1413c, 1);
      scena.add(grupa);
      wizualneNpc.set(auto.id, grupa);
    }
    grupa.position.set(auto.x, 0, auto.z);
  }
}

const hud = {
  wynik: document.getElementById("wynik"),
  zycia: document.getElementById("zycia"),
  koniec: document.getElementById("koniec"),
  koniecWynik: document.getElementById("koniec-wynik"),
  koniecNajlepszy: document.getElementById("koniec-najlepszy"),
};

function aktualizujHud() {
  hud.wynik.textContent = `Wynik: ${Math.floor(gra.punkty)}`;
  hud.zycia.textContent = `Życia: ${gra.zycia}`;
  const koniecGry = gra.scena === "koniec";
  hud.koniec.classList.toggle("ukryty", !koniecGry);
  if (koniecGry) {
    hud.koniecWynik.textContent = `Twój wynik: ${Math.floor(gra.punkty)}`;
    hud.koniecNajlepszy.textContent = `Najlepszy wynik: ${gra.najlepszyWynik}`;
  }
}

const klawisze = { lewo: false, prawo: false };

function ustawKlawisz(kod, wartosc) {
  if (kod === "ArrowLeft" || kod === "KeyA") klawisze.lewo = wartosc;
  if (kod === "ArrowRight" || kod === "KeyD") klawisze.prawo = wartosc;
}

window.addEventListener("keydown", (e) => {
  ustawKlawisz(e.code, true);
  if (
    ["ArrowLeft", "ArrowRight", "Space", "Enter"].includes(e.code)
  ) {
    e.preventDefault();
  }
  if (
    gra.scena === "koniec" &&
    ["KeyR", "Enter", "Space"].includes(e.code)
  ) {
    gra.reset();
  }
});

window.addEventListener("keyup", (e) => ustawKlawisz(e.code, false));
window.addEventListener("blur", () => {
  klawisze.lewo = false;
  klawisze.prawo = false;
});

for (const [id, kierunek] of [
  ["lewo", "lewo"],
  ["prawo", "prawo"],
]) {
  const przycisk = document.getElementById(id);
  const ustaw = (wartosc) => (e) => {
    e.preventDefault();
    klawisze[kierunek] = wartosc;
  };
  przycisk.addEventListener("pointerdown", ustaw(true));
  przycisk.addEventListener("pointerup", ustaw(false));
  przycisk.addEventListener("pointercancel", ustaw(false));
  przycisk.addEventListener("pointerleave", ustaw(false));
}

document.getElementById("restart").addEventListener("click", () => gra.reset());

let poprzedniCzas = 0;
function petla(czas) {
  const dt = poprzedniCzas
    ? Math.min(0.05, (czas - poprzedniCzas) / 1000)
    : 0;
  poprzedniCzas = czas;

  gra.aktualizuj(dt, klawisze.lewo, klawisze.prawo);

  if (gra.scena === "gran") {
    for (const element of elementyRuchome) {
      element.position.z += K.PREDKOSC_NPC * dt;
      if (element.position.z > 12) element.position.z -= 100;
    }
  }

  graczWizual.position.x = gra.gracz.x;
  graczWizual.visible =
    gra.czasNiezr <= 0 || Math.floor(gra.czasNiezr * 12) % 2 === 0;
  synchronizujNpc();

  kamera.position.x +=
    (gra.gracz.x * 0.35 - kamera.position.x) * Math.min(1, dt * 4);
  kamera.lookAt(gra.gracz.x * 0.12, 0.8, -12);

  aktualizujHud();
  renderer.render(scena, kamera);
  requestAnimationFrame(petla);
}

requestAnimationFrame(petla);

// Ułatwia testy w konsoli przeglądarki.
window.gra3d = gra;
